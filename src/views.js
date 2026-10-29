// Renderizacao de HTML via template literals (sem engine externa).
// Todos os links internos usam u() para respeitar o prefixo do modulo (BASE_PATH).

import { BASE_PATH } from './config.js';
const u = (p) => BASE_PATH + p;

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);

const STYLE = `
  :root{--bg:#0f172a;--card:#1e293b;--line:#334155;--txt:#e2e8f0;--mut:#94a3b8;--pri:#2563eb;--ok:#16a34a;--warn:#d97706;--bad:#dc2626}
  *{box-sizing:border-box}
  body{margin:0;font:15px/1.5 system-ui,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--txt)}
  header{background:#020617;padding:14px 24px;border-bottom:1px solid var(--line);display:flex;gap:18px;align-items:center;flex-wrap:wrap}
  header a{color:var(--mut);text-decoration:none;font-size:14px}
  header a:hover{color:var(--txt)}
  .brand{font-weight:700;color:#fff;margin-right:auto}
  main{max-width:980px;margin:0 auto;padding:24px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:20px;margin:0 0 18px}
  h1{font-size:20px;margin:0 0 16px}h2{font-size:16px;margin:0 0 12px}
  table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line)}
  th{color:var(--mut);font-weight:600;font-size:13px}
  label{display:block;margin:12px 0 4px;color:var(--mut);font-size:13px}
  input,select,textarea{width:100%;padding:9px;background:#0f172a;border:1px solid var(--line);border-radius:6px;color:var(--txt);font:inherit}
  textarea{min-height:130px;font-family:ui-monospace,Consolas,monospace;font-size:13px;resize:vertical}
  code{background:#0f172a;border:1px solid var(--line);padding:1px 6px;border-radius:4px;font-size:12px}
  .btn{display:inline-block;background:var(--pri);color:#fff;border:0;padding:9px 16px;border-radius:6px;cursor:pointer;text-decoration:none;font-size:14px}
  .btn.sec{background:#334155}.btn.ok{background:var(--ok)}.btn.bad{background:var(--bad)}.btn.sm{padding:5px 10px;font-size:13px}
  .pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:600}
  .pill.draft{background:#334155;color:#cbd5e1}.pill.scheduled{background:#3730a3;color:#c7d2fe}.pill.running{background:#1e3a8a;color:#bfdbfe}.pill.done{background:#14532d;color:#bbf7d0}
  .tag{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:600}
  .tag.facil{background:#14532d;color:#bbf7d0}.tag.medio{background:#713f12;color:#fde68a}.tag.dificil{background:#450a0a;color:#fca5a5}
  .mut{color:var(--mut);font-size:13px}.ok{color:#4ade80}.warn{color:#fbbf24}.bad{color:#f87171}.good{color:#34d399}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  .stat{background:#0f172a;border:1px solid var(--line);border-radius:8px;padding:14px}
  .stat b{font-size:24px;display:block}
  .chk{display:flex;gap:8px;align-items:center;margin:6px 0}.chk input{width:auto}
  .note{background:#422006;border:1px solid #854d0e;color:#fde68a;padding:10px 14px;border-radius:8px;font-size:13px;margin:0 0 18px}
  .filterbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:4px 0 14px}
  .chip{background:#0f172a;border:1px solid var(--line);color:#cbd5e1;padding:5px 12px;border-radius:999px;cursor:pointer;font-size:13px}
  .chip:hover{border-color:#64748b}.chip.active{background:var(--pri);border-color:var(--pri);color:#fff}
  .fgroup{font-size:12px;color:var(--mut);margin-right:4px;text-transform:uppercase;letter-spacing:.04em}
  .counter{margin-left:auto;color:var(--mut);font-size:13px}
  .inline{display:inline;margin:0}
  .bar{height:7px;border-radius:4px;background:#0f172a;overflow:hidden;min-width:60px}
  .bar>i{display:block;height:100%;background:var(--warn)}
`;

function admin(title, body, user) {
  return `<!doctype html><html lang="pt-br"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · SGI Eng. Social</title><style>${STYLE}</style></head><body>
<header>
  <span class="brand">SGI · Eng. Social</span>
  <a href="${u('/')}">Campanhas</a>
  <a href="${u('/campaigns/new')}">Nova campanha</a>
  <a href="${u('/templates')}">Templates</a>
  <a href="${u('/insights')}">Insights</a>
  <a href="${u('/audit')}">Auditoria</a>
  <a href="${u('/inbox')}">Caixa de saida</a>
  ${user ? `<a href="${u('/logout')}" style="color:#f87171">sair (${esc(user)})</a>` : ''}
</header>
<main>${body}</main></body></html>`;
}

// --------------------------------------------------------------- Login -------
export function loginPage(error) {
  return `<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Entrar · SGI Eng. Social</title>
<style>${STYLE} body{display:flex;min-height:100vh;align-items:center;justify-content:center}</style></head><body>
<form method="POST" action="${u('/login')}" class="card" style="width:320px">
  <h1>SGI · Eng. Social</h1>
  <p class="mut">Painel de administracao</p>
  ${error ? `<div class="note" style="background:#450a0a;border-color:#991b1b;color:#fca5a5">${esc(error)}</div>` : ''}
  <label>Usuario</label><input name="user" autofocus>
  <label>Senha</label><input name="pass" type="password">
  <button class="btn ok" type="submit" style="margin-top:16px;width:100%">Entrar</button>
</form></body></html>`;
}

// ----------------------------------------------------------- Dashboard -------
export function dashboard(campaigns, user) {
  const rows = campaigns.length
    ? campaigns
        .map(
          (c) => `<tr>
          <td><a href="${u('/campaigns/' + c.id)}" style="color:#93c5fd">${esc(c.name)}</a></td>
          <td><span class="pill ${c.status}">${c.status}</span></td>
          <td>${c.targets}</td>
          <td class="warn">${c.clicked}</td>
          <td class="bad">${c.submitted}</td>
          <td class="good">${c.reported}</td>
          <td class="mut">${c.scheduled_at ? fmt(c.scheduled_at) : (c.recurrence ?? '—')}</td>
          <td>
            <form class="inline" method="POST" action="${u('/campaigns/' + c.id + '/clone')}"><button class="btn sec sm">clonar</button></form>
            <form class="inline" method="POST" action="${u('/campaigns/' + c.id + '/delete')}" onsubmit="return confirm('Excluir campanha?')"><button class="btn bad sm">excluir</button></form>
          </td>
        </tr>`
        )
        .join('')
    : `<tr><td colspan="8" class="mut">Nenhuma campanha ainda. Crie a primeira.</td></tr>`;
  return admin(
    'Campanhas',
    `<h1>Campanhas de conscientizacao</h1>
     <p><a class="btn" href="${u('/campaigns/new')}">+ Nova campanha</a></p>
     <div class="card"><table>
       <tr><th>Campanha</th><th>Status</th><th>Alvos</th><th>Clicaram</th><th>Enviaram</th><th>Reportaram</th><th>Agenda/Recorr.</th><th></th></tr>
       ${rows}
     </table></div>`,
    user
  );
}

// -------------------------------------------------------- Nova campanha ------
export function newCampaign(templates, collaborators, user) {
  const tpl = templates
    .map((t) => `<option value="${t.id}">${esc(t.name)} — ${esc(t.difficulty)}</option>`)
    .join('');
  const setores = [...new Set(collaborators.map((c) => c.department))].sort();
  const cargos = [...new Set(collaborators.map((c) => c.cargo))].sort();
  const chips = (g, vals) =>
    vals.map((v) => `<button type="button" class="chip" data-group="${g}" data-val="${esc(v)}">${esc(v)}</button>`).join('');
  const colabs = collaborators
    .map(
      (c) =>
        `<label class="chk"><input type="checkbox" name="targets" value="${c.id}"
            data-setor="${esc(c.department)}" data-cargo="${esc(c.cargo)}" checked>
          ${esc(c.name)} <span class="mut">· ${esc(c.cargo)} · ${esc(c.department)} · ${esc(c.email)}</span></label>`
    )
    .join('');
  return admin(
    'Nova campanha',
    `<h1>Nova campanha</h1>
     <form method="POST" action="${u('/campaigns')}"><div class="card">
       <label>Nome da campanha</label>
       <input name="name" required placeholder="Ex.: Phishing Financeiro - Out/2025">
       <label>Template</label><select name="template_id">${tpl}</select>
       <label>Agendar disparo (opcional — vazio = rascunho para disparo manual)</label>
       <input type="datetime-local" name="scheduled_at">
       <label>Recorrencia</label>
       <select name="recurrence"><option value="">Pontual</option><option value="monthly">Mensal</option><option value="biweekly">Quinzenal</option></select>
       <label>Autorizado por (obrigatorio)</label>
       <input name="approved_by" required placeholder="Ex.: RH + Diretoria - ticket #123">
     </div>
     <div class="card">
       <h2>Alvos do disparo</h2>
       <p class="mut">Filtre por setor e cargo (interseccao). Sem chip ativo, mantem a selecao manual.</p>
       <div class="filterbar"><span class="fgroup">Setor</span>${chips('setor', setores)}</div>
       <div class="filterbar"><span class="fgroup">Cargo</span>${chips('cargo', cargos)}</div>
       <div class="filterbar">
         <button type="button" class="chip" id="selAll">Marcar todos</button>
         <button type="button" class="chip" id="selNone">Desmarcar todos</button>
         <span class="counter"><b id="cnt">0</b> de ${collaborators.length} selecionados</span>
       </div>
       <hr style="border:0;border-top:1px solid #334155;margin:8px 0 14px">
       ${colabs}
     </div>
     <button class="btn ok" type="submit">Criar campanha</button>
     </form>
     <script>
     (function(){
       const boxes=[...document.querySelectorAll('input[name=targets]')];
       const active={setor:new Set(),cargo:new Set()};
       const cnt=document.getElementById('cnt');
       const rc=()=>cnt.textContent=boxes.filter(b=>b.checked).length;
       function apply(){if(!active.setor.size&&!active.cargo.size){rc();return;}
         boxes.forEach(b=>{const s=!active.setor.size||active.setor.has(b.dataset.setor);
           const c=!active.cargo.size||active.cargo.has(b.dataset.cargo);b.checked=s&&c;});rc();}
       document.querySelectorAll('.chip[data-group]').forEach(ch=>ch.onclick=()=>{
         const g=ch.dataset.group,v=ch.dataset.val;ch.classList.toggle('active');
         active[g].has(v)?active[g].delete(v):active[g].add(v);apply();});
       document.getElementById('selAll').onclick=()=>{boxes.forEach(b=>b.checked=true);rc();};
       document.getElementById('selNone').onclick=()=>{boxes.forEach(b=>b.checked=false);rc();};
       boxes.forEach(b=>b.addEventListener('change',rc));rc();
     })();
     </script>`,
    user
  );
}

// ------------------------------------------------------ Relatorio campanha ---
export function campaignReport(c, template, stats, targets, user) {
  const stage = {
    none: '<span class="mut">—</span>',
    email_opened: '<span class="mut">Abriu e-mail</span>',
    link_clicked: '<span class="warn">Clicou no link</span>',
    form_submitted: '<span class="bad">Enviou formulario</span>',
  };
  const rows = targets
    .map(
      (t) => `<tr><td>${esc(t.name)}</td><td class="mut">${esc(t.cargo)}</td><td class="mut">${esc(t.department)}</td>
        <td>${stage[t.stage]}</td>
        <td>${t.reported ? '<span class="good">✓ reportou</span>' : '<span class="mut">—</span>'}</td>
        <td>${t.trained ? '<span class="ok">✓ treino</span>' : '<span class="mut">—</span>'}</td></tr>`
    )
    .join('');
  const launch =
    c.status === 'draft'
      ? `<form class="inline" method="POST" action="${u('/campaigns/' + c.id + '/launch')}"><button class="btn ok" type="submit">Disparar agora</button></form> `
      : '';
  return admin(
    c.name,
    `<p class="mut"><a href="${u('/')}" style="color:#93c5fd">← Campanhas</a></p>
     <h1>${esc(c.name)} <span class="pill ${c.status}">${c.status}</span></h1>
     <p class="mut">Template: ${esc(template.name)} <span class="tag ${template.difficulty}">${template.difficulty}</span>
       · Recorrencia: ${c.recurrence ?? 'pontual'} · Autorizado por: ${esc(c.approved_by)}
       ${c.scheduled_at ? '· Agendada: ' + fmt(c.scheduled_at) : ''}</p>
     <p>${launch}
       <a class="btn sec" href="${u('/campaigns/' + c.id + '/export.csv')}">Exportar CSV</a>
       <form class="inline" method="POST" action="${u('/campaigns/' + c.id + '/clone')}"><button class="btn sec">Clonar</button></form>
     </p>
     <div class="card"><div class="grid">
       <div class="stat"><span class="mut">Alvos</span><b>${stats.total}</b></div>
       <div class="stat"><span class="mut warn">Clicaram</span><b class="warn">${stats.clicked}</b><span class="mut">${pct(stats.clicked, stats.total)}%</span></div>
       <div class="stat"><span class="mut bad">Enviaram</span><b class="bad">${stats.submitted}</b><span class="mut">${pct(stats.submitted, stats.total)}%</span></div>
       <div class="stat"><span class="mut good">Reportaram</span><b class="good">${stats.reported}</b><span class="mut">${pct(stats.reported, stats.total)}%</span></div>
     </div>
     <p class="mut" style="margin-top:14px">Tempo medio ate o clique: <b>${stats.avgReaction ?? '—'}</b>
       · Abriram o e-mail: <b>${stats.opened}</b> · Concluiram o treino: <b>${stats.trained}</b></p>
     </div>
     <div class="card"><h2>Por colaborador</h2><table>
       <tr><th>Nome</th><th>Cargo</th><th>Setor</th><th>Estagio</th><th>Reportou</th><th>Treino</th></tr>${rows}
     </table></div>`,
    user
  );
}

// -------------------------------------------------------------- Insights -----
// Grafico de barras horizontais em SVG (responsivo via viewBox).
// rows: [{ label, pct, value, color }]
function hbars(rows) {
  const W = 640, rowH = 32, top = 6, labelW = 140, valW = 78;
  const barX = labelW, barW = W - labelW - valW;
  const H = top * 2 + rows.length * rowH;
  const body = rows
    .map((r, i) => {
      const y = top + i * rowH, cy = y + rowH / 2;
      const w = Math.max(3, Math.round((Math.min(r.pct, 100) / 100) * barW));
      return (
        `<text x="0" y="${cy}" fill="#cbd5e1" font-size="12.5" dominant-baseline="middle">${esc(r.label)}</text>` +
        `<rect x="${barX}" y="${y + 7}" width="${barW}" height="${rowH - 16}" rx="4" fill="#0f172a"/>` +
        `<rect x="${barX}" y="${y + 7}" width="${w}" height="${rowH - 16}" rx="4" fill="${r.color}"/>` +
        `<text x="${barX + barW + 8}" y="${cy}" fill="#e2e8f0" font-size="12.5" dominant-baseline="middle">${esc(r.value)}</text>`
      );
    })
    .join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMinYMin meet" role="img">${body}</svg>`;
}
const riskColor = (rate) => (rate >= 40 ? '#dc2626' : rate >= 20 ? '#d97706' : '#16a34a');

export function insights(data, user) {
  const f = data.funnel;
  const base = f.sent;
  const fp = (n) => (base ? Math.round((n / base) * 100) : 0);
  // Funil de risco: cada etapa filtra a anterior (enviado -> aberto -> clicou -> enviou form).
  const funnelChart = hbars([
    { label: 'Enviados', pct: 100, value: `${f.sent}`, color: '#475569' },
    { label: 'Abriram e-mail', pct: fp(f.opened), value: `${f.opened} (${fp(f.opened)}%)`, color: '#64748b' },
    { label: 'Clicaram no link', pct: fp(f.clicked), value: `${f.clicked} (${fp(f.clicked)}%)`, color: '#d97706' },
    { label: 'Enviaram senha', pct: fp(f.submitted), value: `${f.submitted} (${fp(f.submitted)}%)`, color: '#dc2626' },
    { label: 'Reportaram ✓', pct: fp(f.reported), value: `${f.reported} (${fp(f.reported)}%)`, color: '#16a34a' },
  ]);

  const setorChart = data.bySetor.length
    ? hbars(data.bySetor.map((r) => {
        const rate = pct(r.clicked, r.total);
        return { label: r.department, pct: rate, value: `${rate}% (${r.clicked}/${r.total})`, color: riskColor(rate) };
      }))
    : `<p class="mut">Sem dados ainda.</p>`;
  const cargoChart = data.byCargo.length
    ? hbars(data.byCargo.map((r) => {
        const rate = pct(r.clicked, r.total);
        return { label: r.cargo, pct: rate, value: `${rate}% (${r.clicked}/${r.total})`, color: riskColor(rate) };
      }))
    : `<p class="mut">Sem dados ainda.</p>`;

  const reinc = data.repeat.length
    ? data.repeat.map((r) => `<tr><td>${esc(r.name)}</td><td class="mut">${esc(r.cargo)}</td><td class="mut">${esc(r.department)}</td><td class="bad">${r.fails} campanha(s)</td></tr>`).join('')
    : empty(4);
  const reporters = data.reporters.length
    ? data.reporters.map((r, i) => `<tr><td>${i === 0 ? '🏆 ' : ''}${esc(r.name)}</td><td class="mut">${esc(r.department)}</td><td class="good">${r.reports} reporte(s)</td></tr>`).join('')
    : empty(3);

  const legend = `<p class="mut" style="margin-top:8px">Cor do risco: <span style="color:#16a34a">verde &lt;20%</span> · <span style="color:#d97706">amarelo 20–40%</span> · <span style="color:#dc2626">vermelho &gt;40%</span></p>`;

  return admin(
    'Insights',
    `<h1>Insights consolidados</h1>
     <div class="card"><div class="grid">
       <div class="stat"><span class="mut">Campanhas</span><b>${data.totals.campaigns}</b></div>
       <div class="stat"><span class="mut warn">Taxa media de clique</span><b class="warn">${data.totals.clickRate}%</b></div>
       <div class="stat"><span class="mut bad">Taxa media de envio</span><b class="bad">${data.totals.submitRate}%</b></div>
       <div class="stat"><span class="mut good">Taxa de reporte</span><b class="good">${data.totals.reportRate}%</b></div>
     </div></div>
     <div class="card"><h2>Funil de risco</h2>
       <p class="mut">Quantos avançaram em cada etapa do ataque simulado. Quanto menor "Enviaram senha" e maior "Reportaram", melhor.</p>
       ${funnelChart}</div>
     <div class="card"><h2>Taxa de clique por setor</h2>${setorChart}${legend}</div>
     <div class="card"><h2>Taxa de clique por cargo</h2>${cargoChart}${legend}</div>
     <div class="card"><h2>Reincidentes <span class="mut">(caíram em +1 campanha — priorizar treino)</span></h2><table>
       <tr><th>Nome</th><th>Cargo</th><th>Setor</th><th>Falhas</th></tr>${reinc}</table></div>
     <div class="card"><h2>Ranking de quem reportou <span class="mut">(comportamento premiado)</span></h2><table>
       <tr><th>Nome</th><th>Setor</th><th>Reportes</th></tr>${reporters}</table></div>`,
    user
  );
}
const empty = (cols) => `<tr><td colspan="${cols}" class="mut">Sem dados ainda.</td></tr>`;

// -------------------------------------------------------------- Auditoria ----
export function auditPage(rows, user) {
  const body = rows.length
    ? rows.map((r) => `<tr><td class="mut">${fmt(r.at)}</td><td>${esc(r.actor ?? '—')}</td><td>${esc(r.action)}</td><td class="mut">${esc(r.detail ?? '')}</td></tr>`).join('')
    : empty(4);
  return admin(
    'Auditoria',
    `<h1>Trilha de auditoria</h1>
     <div class="card"><table><tr><th>Quando</th><th>Quem</th><th>Acao</th><th>Detalhe</th></tr>${body}</table></div>`,
    user
  );
}

// -------------------------------------------------------------- Templates ----
export function templatesList(templates, user) {
  const rows = templates.length
    ? templates
        .map(
          (t) => `<tr>
          <td>${esc(t.name)}</td>
          <td><span class="tag ${t.difficulty}">${t.difficulty}</span></td>
          <td class="mut">${esc(t.subject)}</td>
          <td class="mut">${t.uses} camp.</td>
          <td>
            <a class="btn sec sm" href="${u('/templates/' + t.id)}">prévia</a>
            <a class="btn sec sm" href="${u('/templates/' + t.id + '/edit')}">editar</a>
            <form class="inline" method="POST" action="${u('/templates/' + t.id + '/delete')}" onsubmit="return confirm('Excluir template?')"><button class="btn bad sm">excluir</button></form>
          </td>
        </tr>`
        )
        .join('')
    : `<tr><td colspan="5" class="mut">Nenhum template. Crie o primeiro.</td></tr>`;
  return admin(
    'Templates',
    `<h1>Templates</h1>
     <p><a class="btn" href="${u('/templates/new')}">+ Novo template</a></p>
     <div class="card"><table>
       <tr><th>Nome</th><th>Dificuldade</th><th>Assunto</th><th>Uso</th><th></th></tr>${rows}
     </table></div>`,
    user
  );
}

export function templateForm(values = {}, error = null, user, editId = null) {
  const v = {
    name: values.name ?? '',
    subject: values.subject ?? '',
    difficulty: values.difficulty ?? 'medio',
    email_html:
      values.email_html ??
      `<p>Ola {{name}},</p>
<p>Identificamos uma pendencia de seguranca na sua conta do <b>Portal Interno Grupo Clube</b>.
Confirme seus dados em ate 24 horas para evitar o bloqueio:</p>
<p><a href="{{link}}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Revalidar meu acesso</a></p>
<p style="font-size:12px;color:#64748b">Nao reconhece este e-mail? <a href="{{report}}">Reportar como phishing</a></p>
{{pixel}}`,
    landing_html:
      values.landing_html ??
      `<h1 style="margin:0 0 4px">Portal Interno · Grupo Clube</h1>
<p style="color:#64748b;margin:0 0 24px">Revalidacao de acesso</p>
<form method="POST" action="{{submit}}">
  <label>Usuario</label>
  <input type="text" placeholder="nome.sobrenome" />
  <label>Senha</label>
  <input type="password" placeholder="********" />
  <button type="submit">Entrar</button>
</form>`,
  };
  const opt = (val, lbl) => `<option value="${val}"${v.difficulty === val ? ' selected' : ''}>${lbl}</option>`;
  const err = error ? `<div class="note" style="background:#450a0a;border-color:#991b1b;color:#fca5a5">${esc(error)}</div>` : '';
  const action = editId ? u('/templates/' + editId + '/edit') : u('/templates');
  return admin(
    editId ? 'Editar template' : 'Novo template',
    `<h1>${editId ? 'Editar' : 'Novo'} template</h1>
     ${err}
     <div class="note">
       <b>E-mail:</b> <code>{{name}}</code> · <code>{{link}}</code> (obrigatório) · <code>{{pixel}}</code> abertura · <code>{{report}}</code> botão reportar.<br>
       <b>Página:</b> <code>{{submit}}</code> no action (obrigatório).<br>
       <b>Guardrails:</b> use marca interna genérica (não clone terceiros). Qualquer senha é sempre descartada pelo servidor.
     </div>
     <form method="POST" action="${action}"><div class="card">
       <label>Nome do template</label>
       <input name="name" required value="${esc(v.name)}" placeholder="Ex.: Aviso de RH - 13o salario">
       <label>Assunto do e-mail</label>
       <input name="subject" required value="${esc(v.subject)}">
       <label>Dificuldade</label>
       <select name="difficulty">${opt('facil', 'Fácil')}${opt('medio', 'Médio')}${opt('dificil', 'Difícil')}</select>
       <label>Corpo do e-mail (HTML)</label>
       <textarea name="email_html" required>${esc(v.email_html)}</textarea>
       <label>Página simulada (HTML)</label>
       <textarea name="landing_html" required>${esc(v.landing_html)}</textarea>
     </div>
     <button class="btn ok" type="submit">Salvar template</button>
     <a class="btn sec" href="${u('/templates')}">Cancelar</a>
     </form>`,
    user
  );
}

export function templatePreview(t, sampleEmail, sampleLanding, user) {
  return admin(
    t.name,
    `<p class="mut"><a href="${u('/templates')}" style="color:#93c5fd">← Templates</a></p>
     <h1>${esc(t.name)} <span class="tag ${t.difficulty}">${t.difficulty}</span></h1>
     <p class="mut">Assunto: ${esc(t.subject)}</p>
     <div class="card"><h2>Prévia do e-mail</h2>
       <div style="background:#fff;color:#0f172a;padding:16px;border-radius:8px">${sampleEmail}</div></div>
     <div class="card"><h2>Prévia da página simulada</h2>
       <div style="background:#eef2f7;color:#0f172a;padding:20px;border-radius:8px">${sampleLanding}</div></div>`,
    user
  );
}

// ---------------------------------------------------------- Caixa de saida ---
export function inbox(items, live, user) {
  const rows = items.length
    ? items
        .map(
          (it) => `<div class="card">
          <div class="mut">Para: ${esc(it.email)} · Campanha: ${esc(it.campaign)}</div>
          <h2>${esc(it.subject)}</h2>
          <div style="background:#fff;color:#0f172a;padding:16px;border-radius:8px">${it.body}</div>
        </div>`
        )
        .join('')
    : `<div class="card mut">Nenhum e-mail disparado ainda.</div>`;
  const banner = live
    ? `<div class="note" style="background:#052e16;border-color:#166534;color:#bbf7d0">SMTP configurado: os e-mails estão sendo enviados de verdade. Esta tela mostra uma cópia.</div>`
    : `<div class="note">Modo desenvolvimento: e-mails não são enviados. Clique nos links para simular o colaborador.</div>`;
  return admin('Caixa de saida', `<h1>Caixa de saida</h1>${banner}${rows}`, user);
}

// ---------------------------------------------- Paginas publicas (alvo) ------
export function landingPage(html, reportUrl) {
  return `<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Portal Interno</title>
<style>
  body{margin:0;font:15px system-ui,Segoe UI,sans-serif;background:#eef2f7;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center}
  .box{background:#fff;padding:36px;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.1);width:340px}
  label{display:block;margin:14px 0 4px;font-size:13px;color:#475569}
  input{width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;box-sizing:border-box}
  button{width:100%;margin-top:20px;padding:11px;background:#2563eb;color:#fff;border:0;border-radius:6px;cursor:pointer;font-size:15px}
  .rep{display:block;text-align:center;margin-top:16px;font-size:12px;color:#64748b}
</style></head><body><div class="box">${html}
  <a class="rep" href="${reportUrl}">Isto parece suspeito? Reportar como phishing</a>
</div></body></html>`;
}

// result: null (primeira vez) | {passed, correct, total, points}
export function learnPage(name, token, result) {
  const passed = result && result.passed;
  let banner = '';
  if (passed) {
    banner = `<div style="background:#dcfce7;border:1px solid #86efac;color:#166534;padding:16px;border-radius:8px;margin-top:20px">
        <b style="font-size:20px">✓ Treino concluído!</b><br>
        Nota final: <b>${result.points}/100</b> — você acertou ${result.correct} de ${result.total}. Parabéns! 🎉</div>`;
  } else if (result && result.incomplete) {
    banner = `<div style="background:#fffbeb;border:1px solid #fcd34d;color:#92400e;padding:16px;border-radius:8px;margin-top:20px">
        <b>Avaliação incompleta</b> — você respondeu ${result.answered} de ${result.total} perguntas.
        É preciso responder <b>todas</b> para ser avaliado.
        <div style="margin-top:10px"><a class="btn sec" href="#quiz">Revisar avaliação</a></div></div>`;
  } else if (result) {
    banner = `<div style="background:#fef2f2;border:1px solid #fca5a5;color:#991b1b;padding:16px;border-radius:8px;margin-top:20px">
        <b>Nota: ${result.points}/100</b> — você acertou ${result.correct} de ${result.total}.<br>
        Para concluir o treino é preciso acertar <b>todas</b>. Revise as dicas acima e tente de novo:
        <div style="margin-top:10px"><a class="btn sec" href="#quiz">Revisar avaliação</a></div></div>`;
  }
  const quiz = passed
    ? ''
    : `<form id="quiz" method="POST" action="${u('/t/' + token + '/quiz')}" style="margin-top:20px">
         <h3>Avaliação (precisa de 100 para concluir)</h3>
         <p><b>1.</b> Qual sinal mais indica phishing?</p>
         <label><input type="radio" name="q1" value="a"> E-mail institucional</label><br>
         <label><input type="radio" name="q1" value="b"> Urgência + link pedindo senha</label>
         <p><b>2.</b> O que fazer ao desconfiar de um e-mail?</p>
         <label><input type="radio" name="q2" value="a"> Reportar à TI</label><br>
         <label><input type="radio" name="q2" value="b"> Clicar para verificar</label>
         <p><b>3.</b> Onde conferir o destino real de um link?</p>
         <label><input type="radio" name="q3" value="a"> Passar o mouse e ver a URL</label><br>
         <label><input type="radio" name="q3" value="b"> Confiar no texto do botão</label>
         <button class="btn ok" type="submit" style="margin-top:14px">Enviar respostas</button>
       </form>`;
  return `<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Isto foi um teste</title>
<style>${STYLE}
  body{background:#f8fafc;color:#0f172a}.wrap{max-width:620px;margin:40px auto;padding:0 20px}
  .cardL{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:28px}
  .tagw{display:inline-block;background:#fef3c7;color:#92400e;padding:4px 12px;border-radius:999px;font-size:13px;font-weight:600}
  label{color:#0f172a;display:inline;margin:0} h3{margin:0 0 6px}
  .btn.ok{background:#16a34a}
</style></head><body><div class="wrap"><div class="cardL">
  <span class="tagw">⚠ Simulacao de seguranca</span>
  <h1>Isto foi um teste de phishing do Grupo Clube.</h1>
  <p>Olá${name ? ' ' + esc(name) : ''}, nenhuma informacao sua foi capturada — é um exercicio interno.
  Se fosse real, voce teria entregado suas credenciais a um criminoso.</p>
  <ul>
    <li>Desconfie de urgencia ("em 24h", "sua conta sera bloqueada").</li>
    <li>Passe o mouse sobre o link e confira o endereco antes de clicar.</li>
    <li>Na duvida, acione a TI em vez de preencher o formulario.</li>
  </ul>
  ${banner}${quiz}
</div></div></body></html>`;
}

export function reportThanks(name) {
  return `<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Obrigado</title>
<style>body{font:16px/1.6 system-ui;background:#f8fafc;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center}
.b{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;max-width:460px;text-align:center}</style>
</head><body><div class="b">
  <div style="font-size:40px">✅</div>
  <h1>Obrigado por reportar!</h1>
  <p>Olá${name ? ' ' + esc(name) : ''}, era um teste interno — e voce <b>acertou</b>. Reportar e exatamente
  a atitude certa. Continue assim!</p>
</div></body></html>`;
}

function fmt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
