// Modulo de Engenharia Social como PLUGIN Fastify.
// O SGI integra assim:
//
//   import engSocial from './eng-social/src/module.js';
//   app.register(engSocial, { prefix: '/eng-social' });
//
// O plugin registra o que precisa (formbody, cookie), serve o painel admin,
// o tracking publico e um endpoint de sync de colaboradores.

import formbody from '@fastify/formbody';
import cookie from '@fastify/cookie';
import { randomUUID } from 'node:crypto';
import { db, initSchema, recordEvent, audit, tx } from './db.js';
import { listCollaborators, getCollaborator, importFromSGI } from './collaborators.js';
import { sendMail, isLive } from './mailer.js';
import * as V from './views.js';
import {
  BASE_PATH, ALLOWED_DOMAIN, PUBLIC_BASE_URL,
  ADMIN_USER, ADMIN_PASS, COOKIE_SECRET,
} from './config.js';

const u = (p) => BASE_PATH + p;
const IMPORT_API_KEY = process.env.IMPORT_API_KEY ?? 'dev-key';

// ===================== Logica de negocio (reutilizavel) =====================

function renderEmail(t, token, name) {
  const base = PUBLIC_BASE_URL + u('/t/' + token);
  return t.email_html
    .replaceAll('{{name}}', name)
    .replaceAll('{{link}}', base)
    .replaceAll('{{report}}', base + '/report')
    .replaceAll('{{pixel}}', `<img src="${base}/pixel.gif" width="1" height="1" alt="">`);
}

function targetByToken(token) {
  return db
    .prepare(
      `SELECT ct.id, col.name, t.landing_html
       FROM campaign_targets ct
       JOIN collaborators col ON col.id = ct.collaborator_id
       JOIN campaigns c ON c.id = ct.campaign_id
       JOIN templates t ON t.id = c.template_id
       WHERE ct.token = ?`
    )
    .get(token);
}

function statsFor(id) {
  const q = (type) =>
    db
      .prepare(
        `SELECT COUNT(DISTINCT ct.id) AS n FROM campaign_targets ct
         JOIN events e ON e.campaign_target_id = ct.id AND e.type = ?
         WHERE ct.campaign_id = ?`
      )
      .get(type, id).n;
  const total = db.prepare('SELECT COUNT(*) AS n FROM campaign_targets WHERE campaign_id = ?').get(id).n;
  // Tempo medio ate o primeiro clique.
  const times = db
    .prepare(
      `SELECT ct.email_sent_at AS sent,
         (SELECT MIN(e.occurred_at) FROM events e WHERE e.campaign_target_id=ct.id AND e.type='link_clicked') AS clicked
       FROM campaign_targets ct WHERE ct.campaign_id=?`
    )
    .all(id);
  const diffs = times
    .filter((r) => r.sent && r.clicked)
    .map((r) => new Date(r.clicked) - new Date(r.sent))
    .filter((d) => d >= 0);
  const avg = diffs.length ? fmtDuration(diffs.reduce((a, b) => a + b, 0) / diffs.length) : null;
  return {
    total,
    opened: q('email_opened'),
    clicked: q('link_clicked'),
    submitted: q('form_submitted'),
    reported: q('reported'),
    trained: q('training_completed'),
    avgReaction: avg,
  };
}

function targetsFor(id) {
  return db
    .prepare(
      `SELECT ct.id, col.name, col.department, col.cargo,
         CASE
           WHEN EXISTS(SELECT 1 FROM events e WHERE e.campaign_target_id=ct.id AND e.type='form_submitted') THEN 'form_submitted'
           WHEN EXISTS(SELECT 1 FROM events e WHERE e.campaign_target_id=ct.id AND e.type='link_clicked')   THEN 'link_clicked'
           WHEN EXISTS(SELECT 1 FROM events e WHERE e.campaign_target_id=ct.id AND e.type='email_opened')   THEN 'email_opened'
           ELSE 'none' END AS stage,
         EXISTS(SELECT 1 FROM events e WHERE e.campaign_target_id=ct.id AND e.type='reported') AS reported,
         EXISTS(SELECT 1 FROM events e WHERE e.campaign_target_id=ct.id AND e.type='training_completed') AS trained
       FROM campaign_targets ct JOIN collaborators col ON col.id = ct.collaborator_id
       WHERE ct.campaign_id = ? ORDER BY col.name`
    )
    .all(id);
}

function createCampaign({ name, template_id, recurrence, approved_by, scheduled_at, targetIds }, actor) {
  const status = scheduled_at ? 'scheduled' : 'draft';
  const info = db
    .prepare(
      `INSERT INTO campaigns (name, status, template_id, recurrence, approved_by, created_at, scheduled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(name, status, Number(template_id), recurrence || null, approved_by,
         new Date().toISOString(), scheduled_at || null);
  const cid = info.lastInsertRowid;
  const ins = db.prepare('INSERT OR IGNORE INTO campaign_targets (campaign_id, collaborator_id, token) VALUES (?, ?, ?)');
  for (const tid of targetIds) {
    const colab = getCollaborator(tid);
    // GUARDRAIL: trava de dominio.
    if (!colab || !colab.email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) continue;
    ins.run(cid, Number(tid), randomUUID());
  }
  audit(actor, 'campaign.create', `#${cid} ${name}`);
  return cid;
}

async function launchCampaign(id, actor) {
  const c = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
  if (!c || c.status === 'running' || c.status === 'done') return;
  const now = new Date().toISOString();
  const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(c.template_id);
  const targets = db
    .prepare(
      `SELECT ct.id, ct.token, col.email, col.name FROM campaign_targets ct
       JOIN collaborators col ON col.id = ct.collaborator_id
       WHERE ct.campaign_id = ? AND ct.email_sent_at IS NULL`
    )
    .all(id);
  for (const t of targets) {
    try {
      await sendMail({ to: t.email, subject: template.subject, html: renderEmail(template, t.token, t.name) });
    } catch (e) {
      // Em producao, logar a falha de envio por alvo. No MVP seguimos.
    }
    db.prepare('UPDATE campaign_targets SET email_sent_at = ? WHERE id = ?').run(now, t.id);
  }
  db.prepare("UPDATE campaigns SET status='running', launched_at=? WHERE id=?").run(now, id);
  audit(actor, 'campaign.launch', `#${id} alvos=${targets.length} ${isLive ? 'SMTP' : 'dev'}`);
  if (c.recurrence) scheduleNext(c);
}

// Recorrencia: cria a proxima ocorrencia agendada, com os mesmos alvos.
function scheduleNext(c) {
  const next = new Date(c.scheduled_at ? new Date(c.scheduled_at) : Date.now());
  if (c.recurrence === 'monthly') next.setMonth(next.getMonth() + 1);
  else if (c.recurrence === 'biweekly') next.setDate(next.getDate() + 14);
  else return;
  const targetIds = db.prepare('SELECT collaborator_id FROM campaign_targets WHERE campaign_id=?').all(c.id).map((r) => r.collaborator_id);
  createCampaign({
    name: `${c.name} (recorrência ${next.toLocaleDateString('pt-BR')})`,
    template_id: c.template_id, recurrence: c.recurrence, approved_by: c.approved_by,
    scheduled_at: next.toISOString(), targetIds,
  }, 'scheduler');
}

function cloneCampaign(id, actor) {
  const c = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
  if (!c) return null;
  const targetIds = db.prepare('SELECT collaborator_id FROM campaign_targets WHERE campaign_id=?').all(id).map((r) => r.collaborator_id);
  const nid = createCampaign({
    name: `${c.name} (cópia)`, template_id: c.template_id, recurrence: c.recurrence,
    approved_by: c.approved_by, scheduled_at: null, targetIds,
  }, actor);
  audit(actor, 'campaign.clone', `#${id} -> #${nid}`);
  return nid;
}

function deleteCampaign(id, actor) {
  tx(() => {
    db.prepare('DELETE FROM events WHERE campaign_target_id IN (SELECT id FROM campaign_targets WHERE campaign_id=?)').run(id);
    db.prepare('DELETE FROM campaign_targets WHERE campaign_id=?').run(id);
    db.prepare('DELETE FROM campaigns WHERE id=?').run(id);
  });
  audit(actor, 'campaign.delete', `#${id}`);
}

function insightsData() {
  const group = (col) =>
    db
      .prepare(
        `SELECT col.${col} AS k, COUNT(DISTINCT ct.id) AS total,
           COUNT(DISTINCT CASE WHEN e.type='link_clicked' THEN ct.id END) AS clicked,
           COUNT(DISTINCT CASE WHEN e.type='form_submitted' THEN ct.id END) AS submitted
         FROM campaign_targets ct
         JOIN collaborators col ON col.id = ct.collaborator_id
         LEFT JOIN events e ON e.campaign_target_id = ct.id
         GROUP BY col.${col} ORDER BY submitted DESC, clicked DESC`
      )
      .all();
  const bySetor = group('department').map((r) => ({ department: r.k, total: r.total, clicked: r.clicked, submitted: r.submitted }));
  const byCargo = group('cargo').map((r) => ({ cargo: r.k, total: r.total, clicked: r.clicked, submitted: r.submitted }));

  // Reincidentes: caíram (clique OU envio) em mais de uma campanha.
  const repeat = db
    .prepare(
      `SELECT col.name, col.cargo, col.department, COUNT(DISTINCT ct.campaign_id) AS fails
       FROM campaign_targets ct JOIN collaborators col ON col.id = ct.collaborator_id
       JOIN events e ON e.campaign_target_id = ct.id AND e.type IN ('link_clicked','form_submitted')
       GROUP BY col.id HAVING fails > 1 ORDER BY fails DESC`
    )
    .all();
  const reporters = db
    .prepare(
      `SELECT col.name, col.department, COUNT(*) AS reports
       FROM events e JOIN campaign_targets ct ON ct.id = e.campaign_target_id
       JOIN collaborators col ON col.id = ct.collaborator_id
       WHERE e.type='reported' GROUP BY col.id ORDER BY reports DESC LIMIT 10`
    )
    .all();

  const agg = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM campaigns) AS campaigns,
         (SELECT COUNT(*) FROM campaign_targets) AS total,
         (SELECT COUNT(*) FROM campaign_targets WHERE email_sent_at IS NOT NULL) AS sent,
         (SELECT COUNT(DISTINCT campaign_target_id) FROM events WHERE type='email_opened') AS opened,
         (SELECT COUNT(DISTINCT campaign_target_id) FROM events WHERE type='link_clicked') AS clicked,
         (SELECT COUNT(DISTINCT campaign_target_id) FROM events WHERE type='form_submitted') AS submitted,
         (SELECT COUNT(DISTINCT campaign_target_id) FROM events WHERE type='reported') AS reported`
    )
    .get();
  const rate = (n) => (agg.total ? Math.round((n / agg.total) * 100) : 0);
  return {
    bySetor, byCargo, repeat, reporters,
    funnel: { sent: agg.sent, opened: agg.opened, clicked: agg.clicked, submitted: agg.submitted, reported: agg.reported },
    totals: { campaigns: agg.campaigns, clickRate: rate(agg.clicked), submitRate: rate(agg.submitted), reportRate: rate(agg.reported) },
  };
}

function fmtDuration(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}min`;
}

// ============================ Plugin Fastify ================================

export default async function engSocial(app) {
  initSchema();
  await app.register(formbody);
  await app.register(cookie, { secret: COOKIE_SECRET });

  const html = (reply, body) => reply.type('text/html; charset=utf-8').send(body);
  const pub = { config: { public: true } };

  // --- Autenticacao: protege tudo, exceto rotas publicas marcadas -----------
  app.addHook('preHandler', (req, reply, done) => {
    if (req.routeOptions.config?.public) return done();
    const raw = req.cookies.sess;
    if (raw) {
      const r = app.unsignCookie(raw);
      if (r.valid && r.value) { req.user = r.value; return done(); }
    }
    reply.redirect(u('/login'));
  });

  // --- Login / logout -------------------------------------------------------
  app.get('/login', pub, (req, reply) => html(reply, V.loginPage()));
  app.post('/login', pub, (req, reply) => {
    const { user, pass } = req.body;
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      reply.setCookie('sess', user, { signed: true, httpOnly: true, sameSite: 'lax', path: BASE_PATH || '/' });
      audit(user, 'login', 'ok');
      return reply.redirect(u('/'));
    }
    html(reply.code(401), V.loginPage('Usuario ou senha invalidos.'));
  });
  app.get('/logout', (req, reply) => {
    reply.clearCookie('sess', { path: BASE_PATH || '/' });
    reply.redirect(u('/login'));
  });

  // --- Dashboard ------------------------------------------------------------
  app.get('/', (req, reply) => {
    const campaigns = db.prepare('SELECT * FROM campaigns ORDER BY id DESC').all().map((c) => ({ ...c, ...statsFor(c.id) }));
    html(reply, V.dashboard(campaigns, req.user));
  });

  // --- Campanhas ------------------------------------------------------------
  app.get('/campaigns/new', (req, reply) => {
    const templates = db.prepare('SELECT * FROM templates ORDER BY id').all();
    html(reply, V.newCampaign(templates, listCollaborators(), req.user));
  });
  app.post('/campaigns', (req, reply) => {
    const { name, template_id, recurrence, approved_by, scheduled_at } = req.body;
    if (!name || !approved_by) return reply.code(400).send('Nome e autorizacao sao obrigatorios.');
    let targets = req.body.targets ?? [];
    if (!Array.isArray(targets)) targets = [targets];
    const cid = createCampaign({ name, template_id, recurrence, approved_by, scheduled_at, targetIds: targets }, req.user);
    reply.redirect(u('/campaigns/' + cid));
  });
  app.post('/campaigns/:id/launch', async (req, reply) => {
    await launchCampaign(Number(req.params.id), req.user);
    reply.redirect(u('/campaigns/' + req.params.id));
  });
  app.post('/campaigns/:id/clone', (req, reply) => {
    const nid = cloneCampaign(Number(req.params.id), req.user);
    reply.redirect(u('/campaigns/' + nid));
  });
  app.post('/campaigns/:id/delete', (req, reply) => {
    deleteCampaign(Number(req.params.id), req.user);
    reply.redirect(u('/'));
  });
  app.get('/campaigns/:id', (req, reply) => {
    const id = Number(req.params.id);
    const c = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
    if (!c) return reply.code(404).send('Campanha nao encontrada.');
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(c.template_id);
    html(reply, V.campaignReport(c, template, statsFor(id), targetsFor(id), req.user));
  });
  app.get('/campaigns/:id/export.csv', (req, reply) => {
    const id = Number(req.params.id);
    const rows = targetsFor(id);
    const head = 'nome,cargo,setor,estagio,reportou,treino\n';
    const body = rows
      .map((r) => [r.name, r.cargo, r.department, r.stage, r.reported ? 'sim' : 'nao', r.trained ? 'sim' : 'nao']
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    reply.header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="campanha-${id}.csv"`)
      .send(head + body);
  });

  // --- Templates ------------------------------------------------------------
  app.get('/templates', (req, reply) => {
    const t = db.prepare(`SELECT t.*, (SELECT COUNT(*) FROM campaigns c WHERE c.template_id=t.id) AS uses FROM templates t ORDER BY t.id DESC`).all();
    html(reply, V.templatesList(t, req.user));
  });
  app.get('/templates/new', (req, reply) => html(reply, V.templateForm({}, null, req.user)));
  function validateTemplate(b) {
    if (!b.name || !b.subject || !b.email_html || !b.landing_html) return 'Preencha todos os campos.';
    if (!b.email_html.includes('{{link}}')) return 'O corpo do e-mail precisa conter {{link}}.';
    if (!b.landing_html.includes('{{submit}}')) return 'A pagina precisa conter {{submit}} no action.';
    return null;
  }
  app.post('/templates', (req, reply) => {
    const err = validateTemplate(req.body);
    if (err) return html(reply.code(400), V.templateForm(req.body, err, req.user));
    const { name, subject, email_html, landing_html, difficulty } = req.body;
    db.prepare('INSERT INTO templates (name, subject, email_html, landing_html, difficulty) VALUES (?,?,?,?,?)')
      .run(name, subject, email_html, landing_html, difficulty || 'medio');
    audit(req.user, 'template.create', name);
    reply.redirect(u('/templates'));
  });
  app.get('/templates/:id/edit', (req, reply) => {
    const t = db.prepare('SELECT * FROM templates WHERE id=?').get(Number(req.params.id));
    if (!t) return reply.code(404).send('Template nao encontrado.');
    html(reply, V.templateForm(t, null, req.user, t.id));
  });
  app.post('/templates/:id/edit', (req, reply) => {
    const id = Number(req.params.id);
    const err = validateTemplate(req.body);
    if (err) return html(reply.code(400), V.templateForm(req.body, err, req.user, id));
    const { name, subject, email_html, landing_html, difficulty } = req.body;
    db.prepare('UPDATE templates SET name=?, subject=?, email_html=?, landing_html=?, difficulty=? WHERE id=?')
      .run(name, subject, email_html, landing_html, difficulty || 'medio', id);
    audit(req.user, 'template.edit', `#${id}`);
    reply.redirect(u('/templates'));
  });
  app.post('/templates/:id/delete', (req, reply) => {
    const id = Number(req.params.id);
    const used = db.prepare('SELECT COUNT(*) AS n FROM campaigns WHERE template_id=?').get(id).n;
    if (used > 0) return reply.code(409).send('Template em uso por campanhas; nao pode ser excluido.');
    db.prepare('DELETE FROM templates WHERE id=?').run(id);
    audit(req.user, 'template.delete', `#${id}`);
    reply.redirect(u('/templates'));
  });
  app.get('/templates/:id', (req, reply) => {
    const t = db.prepare('SELECT * FROM templates WHERE id=?').get(Number(req.params.id));
    if (!t) return reply.code(404).send('Template nao encontrado.');
    const se = t.email_html.replaceAll('{{name}}', 'Ana Souza').replaceAll('{{link}}', '#').replaceAll('{{report}}', '#').replaceAll('{{pixel}}', '');
    const sl = t.landing_html.replaceAll('{{submit}}', '#');
    html(reply, V.templatePreview(t, se, sl, req.user));
  });

  // --- Insights / Auditoria / Inbox ----------------------------------------
  app.get('/insights', (req, reply) => html(reply, V.insights(insightsData(), req.user)));
  app.get('/audit', (req, reply) => {
    const rows = db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200').all();
    html(reply, V.auditPage(rows, req.user));
  });
  app.get('/inbox', (req, reply) => {
    const rows = db
      .prepare(
        `SELECT ct.token, col.name, col.email, c.name AS campaign, t.subject, t.email_html
         FROM campaign_targets ct
         JOIN campaigns c ON c.id = ct.campaign_id
         JOIN collaborators col ON col.id = ct.collaborator_id
         JOIN templates t ON t.id = c.template_id
         WHERE ct.email_sent_at IS NOT NULL ORDER BY ct.email_sent_at DESC, col.name`
      )
      .all();
    const items = rows.map((r) => ({ email: r.email, campaign: r.campaign, subject: r.subject, body: renderEmail(r, r.token, r.name) }));
    html(reply, V.inbox(items, isLive, req.user));
  });

  // --- Sync de colaboradores (SGI -> modulo), protegido por API key ---------
  app.post('/collaborators/import', pub, (req, reply) => {
    if (req.headers['x-api-key'] !== IMPORT_API_KEY) return reply.code(401).send({ error: 'api key invalida' });
    try {
      const result = importFromSGI(req.body?.people ?? req.body, 'sgi-sync');
      reply.send(result);
    } catch (e) {
      reply.code(400).send({ error: String(e.message) });
    }
  });

  // ===================== TRACKING (publico) ================================
  const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

  app.get('/t/:token/pixel.gif', pub, (req, reply) => {
    const tgt = targetByToken(req.params.token);
    if (tgt) recordEvent(tgt.id, 'email_opened', req.ip, req.headers['user-agent']);
    reply.type('image/gif').header('Cache-Control', 'no-store').send(PIXEL);
  });
  app.get('/t/:token', pub, (req, reply) => {
    const tgt = targetByToken(req.params.token);
    if (!tgt) return reply.code(404).send('Link invalido ou expirado.');
    recordEvent(tgt.id, 'link_clicked', req.ip, req.headers['user-agent']);
    const page = tgt.landing_html.replaceAll('{{submit}}', u('/t/' + req.params.token + '/submit'));
    html(reply, V.landingPage(page, u('/t/' + req.params.token + '/report')));
  });
  // Envio do formulario -> registra evento e DESCARTA o corpo (nenhuma senha salva).
  app.post('/t/:token/submit', pub, (req, reply) => {
    const tgt = targetByToken(req.params.token);
    if (!tgt) return reply.code(404).send('Link invalido.');
    recordEvent(tgt.id, 'form_submitted', req.ip, req.headers['user-agent']);
    reply.redirect(u('/learn/' + req.params.token));
  });
  // Reportar como phishing (comportamento correto).
  app.get('/t/:token/report', pub, (req, reply) => {
    const tgt = targetByToken(req.params.token);
    if (!tgt) return reply.code(404).send('Link invalido.');
    recordEvent(tgt.id, 'reported', req.ip, req.headers['user-agent']);
    html(reply, V.reportThanks(tgt.name));
  });
  // Gabarito da avaliacao.
  const QUIZ_KEY = { q1: 'b', q2: 'a', q3: 'a' };
  const QUIZ_TOTAL = Object.keys(QUIZ_KEY).length;

  app.get('/learn/:token', pub, (req, reply) => {
    const tgt = targetByToken(req.params.token);
    const done = tgt ? !!db.prepare("SELECT 1 FROM events WHERE campaign_target_id=? AND type='training_completed'").get(tgt.id) : false;
    const result = done ? { passed: true, correct: QUIZ_TOTAL, total: QUIZ_TOTAL, points: 100 } : null;
    html(reply, V.learnPage(tgt?.name, req.params.token, result));
  });
  app.post('/t/:token/quiz', pub, (req, reply) => {
    const tgt = targetByToken(req.params.token);
    const body = req.body || {};
    // Corrige, pontua e detecta incompleto. So conclui com 100% (todas certas).
    let correct = 0, answered = 0;
    for (const k in QUIZ_KEY) {
      if (body[k] != null && body[k] !== '') {
        answered++;
        if (body[k] === QUIZ_KEY[k]) correct++;
      }
    }
    const incomplete = answered < QUIZ_TOTAL;
    const points = Math.round((correct / QUIZ_TOTAL) * 100);
    const passed = !incomplete && correct === QUIZ_TOTAL;
    if (passed && tgt) recordEvent(tgt.id, 'training_completed', req.ip, req.headers['user-agent']);
    html(reply, V.learnPage(tgt?.name, req.params.token, { passed, correct, total: QUIZ_TOTAL, points, incomplete, answered }));
  });

  // --- Scheduler em processo (dev). Em producao: BullMQ + Redis. ------------
  const tick = async () => {
    const due = db.prepare("SELECT id FROM campaigns WHERE status='scheduled' AND scheduled_at <= ?").all(new Date().toISOString());
    for (const r of due) await launchCampaign(r.id, 'scheduler');
  };
  const timer = setInterval(() => tick().catch(() => {}), 30000);
  app.addHook('onClose', (_i, done) => { clearInterval(timer); done(); });
}
