// Camada de banco de dados usando o SQLite nativo do Node (node:sqlite).
// Sem dependencia nativa pra compilar, sem servidor de banco externo.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DB_PATH } from './config.js';

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS collaborators (
      id         INTEGER PRIMARY KEY,
      ext_id     TEXT,                              -- id na base do SGI (para sync)
      name       TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE,
      department TEXT NOT NULL,                      -- setor
      cargo      TEXT NOT NULL DEFAULT 'Colaborador',
      active     INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS templates (
      id           INTEGER PRIMARY KEY,
      name         TEXT NOT NULL,
      subject      TEXT NOT NULL,
      email_html   TEXT NOT NULL,   -- {{name}} {{link}} {{pixel}} {{report}}
      landing_html TEXT NOT NULL,   -- {{submit}}
      difficulty   TEXT NOT NULL DEFAULT 'medio'    -- facil | medio | dificil
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id           INTEGER PRIMARY KEY,
      name         TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'draft',    -- draft|scheduled|running|done
      template_id  INTEGER NOT NULL REFERENCES templates(id),
      recurrence   TEXT,                             -- NULL|monthly|biweekly
      approved_by  TEXT,
      created_at   TEXT NOT NULL,
      scheduled_at TEXT,                             -- disparo agendado (ISO)
      launched_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS campaign_targets (
      id              INTEGER PRIMARY KEY,
      campaign_id     INTEGER NOT NULL REFERENCES campaigns(id),
      collaborator_id INTEGER NOT NULL REFERENCES collaborators(id),
      token           TEXT NOT NULL UNIQUE,
      email_sent_at   TEXT,
      UNIQUE (campaign_id, collaborator_id)
    );

    -- Eventos append-only. SEM coluna de senha, propositalmente.
    -- type: email_opened | link_clicked | form_submitted | reported | training_completed
    CREATE TABLE IF NOT EXISTS events (
      id                 INTEGER PRIMARY KEY,
      campaign_target_id INTEGER NOT NULL REFERENCES campaign_targets(id),
      type               TEXT NOT NULL,
      occurred_at        TEXT NOT NULL,
      ip                 TEXT,
      user_agent         TEXT
    );

    -- Trilha de auditoria: quem fez o que no painel.
    CREATE TABLE IF NOT EXISTS audit_log (
      id       INTEGER PRIMARY KEY,
      actor    TEXT,
      action   TEXT NOT NULL,
      detail   TEXT,
      at       TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_target ON events(campaign_target_id);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
    CREATE INDEX IF NOT EXISTS idx_targets_campaign ON campaign_targets(campaign_id);
  `);

  // Migracoes idempotentes para bancos criados antes destes campos.
  migrate('collaborators', 'cargo', "TEXT NOT NULL DEFAULT 'Colaborador'");
  migrate('collaborators', 'ext_id', 'TEXT');
  migrate('collaborators', 'active', 'INTEGER NOT NULL DEFAULT 1');
  migrate('templates', 'difficulty', "TEXT NOT NULL DEFAULT 'medio'");
  migrate('campaigns', 'scheduled_at', 'TEXT');
}

function migrate(table, column, decl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
  }
}

// Registra um evento apenas uma vez por alvo+tipo (idempotente).
export function recordEvent(targetId, type, ip, userAgent) {
  const exists = db
    .prepare('SELECT 1 FROM events WHERE campaign_target_id = ? AND type = ? LIMIT 1')
    .get(targetId, type);
  if (exists) return false;
  db.prepare(
    `INSERT INTO events (campaign_target_id, type, occurred_at, ip, user_agent)
     VALUES (?, ?, ?, ?, ?)`
  ).run(targetId, type, new Date().toISOString(), ip ?? null, userAgent ?? null);
  return true;
}

// Transacao (node:sqlite nao expõe .transaction() como o better-sqlite3).
export function tx(fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function audit(actor, action, detail) {
  db.prepare('INSERT INTO audit_log (actor, action, detail, at) VALUES (?, ?, ?, ?)').run(
    actor ?? null,
    action,
    detail ?? null,
    new Date().toISOString()
  );
}
