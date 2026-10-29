// Expurgo LGPD: remove eventos/campanhas mais antigos que a retencao definida.
// Uso: npm run purge   (usa RETENTION_DAYS, padrao 180)
//      RETENTION_DAYS=90 npm run purge

import { db, initSchema, audit, tx } from './db.js';
import { RETENTION_DAYS } from './config.js';

initSchema();
const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString();

const old = db.prepare('SELECT id FROM campaigns WHERE created_at < ?').all(cutoff).map((r) => r.id);
tx(() => {
  for (const id of old) {
    db.prepare('DELETE FROM events WHERE campaign_target_id IN (SELECT id FROM campaign_targets WHERE campaign_id=?)').run(id);
    db.prepare('DELETE FROM campaign_targets WHERE campaign_id=?').run(id);
    db.prepare('DELETE FROM campaigns WHERE id=?').run(id);
  }
});
audit('purge', 'retention.purge', `removidas=${old.length} retencao=${RETENTION_DAYS}d`);
console.log(`Expurgo concluido: ${old.length} campanha(s) anteriores a ${cutoff.slice(0, 10)} removidas.`);
