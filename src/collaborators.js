// Fonte de colaboradores (adapter).
//
// No MVP, os colaboradores vivem na tabela local `collaborators` (dados ficticios).
// Em producao, o SGI sincroniza sua base real chamando importFromSGI() — por um job
// agendado ou por POST /collaborators/import. A trava de dominio continua valendo.

import { db, audit, tx } from './db.js';
import { ALLOWED_DOMAIN } from './config.js';

export function listCollaborators({ activeOnly = true } = {}) {
  const where = activeOnly ? 'WHERE active = 1' : '';
  return db.prepare(`SELECT * FROM collaborators ${where} ORDER BY name`).all();
}

export function getCollaborator(id) {
  return db.prepare('SELECT * FROM collaborators WHERE id = ?').get(Number(id));
}

// Sincroniza uma lista vinda do SGI. Cada item: {ext_id?, name, email, department, cargo}.
// Faz upsert por e-mail, respeita a trava de dominio e retorna um resumo.
export function importFromSGI(people, actor = 'sync') {
  if (!Array.isArray(people)) throw new Error('Esperado um array de colaboradores.');
  const up = db.prepare(`
    INSERT INTO collaborators (ext_id, name, email, department, cargo, active)
    VALUES (@ext_id, @name, @email, @department, @cargo, 1)
    ON CONFLICT(email) DO UPDATE SET
      ext_id=excluded.ext_id, name=excluded.name,
      department=excluded.department, cargo=excluded.cargo, active=1
  `);
  let imported = 0,
    skipped = 0;
  tx(() => {
    for (const p of people) {
      const email = String(p.email ?? '').trim().toLowerCase();
      // GUARDRAIL: so aceita e-mails do dominio autorizado.
      if (!email.endsWith(`@${ALLOWED_DOMAIN}`) || !p.name) {
        skipped++;
        continue;
      }
      up.run({
        ext_id: p.ext_id ?? null,
        name: p.name,
        email,
        department: p.department ?? 'N/D',
        cargo: p.cargo ?? 'Colaborador',
      });
      imported++;
    }
  });
  audit(actor, 'collaborators.import', `importados=${imported} ignorados=${skipped}`);
  return { imported, skipped };
}
