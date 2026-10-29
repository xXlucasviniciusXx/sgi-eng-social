# Guia de Integração — Módulo de Engenharia Social no SGI

> Para o desenvolvedor que vai plugar este módulo no SGI. Explica a arquitetura,
> como montar o plugin, o mapa de rotas, o modelo de dados, os pontos de
> integração e o que falta para produção.

---

## 1. Visão geral

Este é um **módulo de simulação de phishing para conscientização interna**. Mede
quem **abre**, **clica**, **envia o formulário** — e quem **reporta** (o
comportamento correto) — para treinar a equipe. **Não captura credenciais.**

Tecnicamente é um **plugin Fastify** autossuficiente:

- Registra suas próprias dependências (`@fastify/formbody`, `@fastify/cookie`).
- Cria e migra suas próprias tabelas (idempotente, no boot).
- Serve três superfícies: **painel admin**, **tracking público** e **sync de
  colaboradores**.

Stack: **Fastify 5**, **`node:sqlite`** (SQLite nativo do Node 22.5+, sem build
nativo), **Nodemailer**. Sem banco externo no MVP.

---

## 2. Como montar no SGI

O `app.js` deste repositório é só um _host_ standalone para desenvolvimento. No
SGI, a integração é uma linha:

```js
import engSocial from './eng-social/src/module.js';

app.register(engSocial, { prefix: '/eng-social' });
```

O plugin se auto-contém; não é preciso registrar `formbody`/`cookie` por fora
(ele faz isso internamente, encapsulado no escopo do plugin).

### Requisitos de runtime

O `node:sqlite` ainda é experimental. O processo precisa subir com:

```
node --experimental-sqlite --disable-warning=ExperimentalWarning <entry>
```

Já está nos scripts do `package.json`. Se o SGI roda em outra versão de Node,
veja a seção 7 (trocar a camada de banco) antes de integrar.

### Variáveis de ambiente (todas com default de DEV — trocar em produção)

| Var | Default | Função |
|---|---|---|
| `PORT` | 3000 | porta (só no host standalone) |
| `BASE_PATH` | `/eng-social` | prefixo de montagem |
| `ALLOWED_DOMAIN` | `grupoclube.com.br` | **trava de domínio** dos alvos |
| `PUBLIC_BASE_URL` | `http://localhost:PORT` | base dos links rastreados nos e-mails |
| `ADMIN_USER` / `ADMIN_PASS` | `admin` / `admin` | login do painel |
| `COOKIE_SECRET` | (dev) | assinatura do cookie de sessão |
| `IMPORT_API_KEY` | `dev-key` | chave do endpoint de sync de colaboradores |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM` | — | envio real de e-mail |
| `RETENTION_DAYS` | 180 | retenção do expurgo LGPD |

> ⚠️ **O repositório é público.** `ADMIN_PASS`, `COOKIE_SECRET` e
> `IMPORT_API_KEY` têm valores de desenvolvimento no `config.js` **apenas como
> fallback**. Em produção, todos devem vir do ambiente (`process.env`) — nunca
> commitar segredos.

---

## 3. Arquitetura dos arquivos (`src/`)

| Arquivo | Papel |
|---|---|
| `module.js` | **O plugin.** Rotas, lógica de negócio, auth, tracking, scheduler. |
| `db.js` | Camada SQLite: schema, migrações idempotentes, `recordEvent`, `tx`, `audit`. |
| `collaborators.js` | **Adapter da fonte de pessoas.** `listCollaborators`, `getCollaborator`, `importFromSGI`. **Ponto de integração principal.** |
| `mailer.js` | Nodemailer. Sem SMTP → modo dev (Caixa de saída). Com SMTP → envia. |
| `views.js` | Toda a UI (HTML via template literals) + gráficos SVG inline. |
| `config.js` | Config central lida de `process.env` com defaults de dev. |
| `app.js` | Host standalone (dev). **Não vai para o SGI.** |
| `seed.js` / `purge.js` | Popular dados fictícios / expurgo LGPD. |

Camadas: `views.js` (apresentação) ← `module.js` (negócio + rotas) ←
`db.js` + `collaborators.js` + `mailer.js` (infra). A lógica de negócio
(`createCampaign`, `launchCampaign`, `statsFor`, `insightsData`…) está isolada no
topo de `module.js` e é reutilizável fora das rotas.

---

## 4. Mapa de rotas

Todas sob o prefixo `BASE_PATH` (`/eng-social`).

### Painel admin (protegido por cookie de sessão)

| Método | Rota | Função |
|---|---|---|
| GET | `/login` · POST `/login` · GET `/logout` | autenticação |
| GET | `/` | dashboard de campanhas (com stats por campanha) |
| GET | `/campaigns/new` · POST `/campaigns` | criar campanha (filtros por setor/cargo) |
| POST | `/campaigns/:id/launch` | disparar |
| POST | `/campaigns/:id/clone` | clonar |
| POST | `/campaigns/:id/delete` | excluir (cascade manual via `tx`) |
| GET | `/campaigns/:id` | relatório (funil + por colaborador) |
| GET | `/campaigns/:id/export.csv` | export CSV |
| GET/POST | `/templates*` | CRUD de templates + prévia |
| GET | `/insights` | consolidado (setor, cargo, reincidentes, reporters, gráficos SVG) |
| GET | `/audit` | trilha de auditoria (últimos 200) |
| GET | `/inbox` | Caixa de saída (preview dos e-mails em modo dev) |

### Tracking (público — sem auth, marcado com `config: { public: true }`)

| Método | Rota | Evento registrado |
|---|---|---|
| GET | `/t/:token/pixel.gif` | `email_opened` (pixel 1x1) |
| GET | `/t/:token` | `link_clicked` → serve landing page |
| POST | `/t/:token/submit` | `form_submitted` → **descarta o corpo** → redirect p/ learn |
| GET | `/t/:token/report` | `reported` (comportamento correto) |
| GET | `/learn/:token` | página educativa + avaliação |
| POST | `/t/:token/quiz` | corrige, pontua; só grava `training_completed` com 100% |

### Sync de colaboradores (público, protegido por `x-api-key`)

| Método | Rota |
|---|---|
| POST | `/collaborators/import` |

```bash
curl -X POST https://sgi.example/eng-social/collaborators/import \
  -H "x-api-key: $IMPORT_API_KEY" \
  -H "content-type: application/json" \
  -d '{"people":[{"ext_id":"123","name":"Ana Souza","email":"ana@grupoclube.com.br","department":"TI","cargo":"Analista"}]}'
# -> { "imported": 1, "skipped": 0 }
```

---

## 5. Modelo de dados (`db.js`)

| Tabela | Papel | Campos-chave |
|---|---|---|
| `collaborators` | base de pessoas (local ou sincronizada do SGI) | `ext_id` (id no SGI), `email` UNIQUE, `department`, `cargo`, `active` |
| `templates` | e-mail isca + página simulada | `email_html`, `landing_html`, `difficulty` |
| `campaigns` | cada disparo isolado | `status` (draft/scheduled/running/done), `recurrence`, `scheduled_at` |
| `campaign_targets` | quem recebeu o quê | `token` UNIQUE (URL rastreável), `email_sent_at`, UNIQUE(campaign_id, collaborator_id) |
| `events` | **append-only** | `type`, `occurred_at`, `ip`, `user_agent` — **sem coluna de senha** |
| `audit_log` | quem fez o quê no painel | `actor`, `action`, `detail`, `at` |

**Eventos (`events.type`):** `email_opened` · `link_clicked` · `form_submitted`
· `reported` · `training_completed`. `recordEvent()` é **idempotente por
alvo+tipo** (cada tipo conta no máximo uma vez por alvo).

**Placeholders de template:**
- E-mail: `{{name}}` `{{link}}` `{{pixel}}` `{{report}}`
- Landing: `{{submit}}` (vai no `action` do form)

**Transações:** `node:sqlite` (`DatabaseSync`) **não tem `.transaction()`** como o
better-sqlite3. Use o helper `tx(fn)` de `db.js` (BEGIN/COMMIT/ROLLBACK manual).

---

## 6. Ponto de integração: a fonte de colaboradores

É aqui que o desenvolvedor conecta o SGI. O módulo **não acopla** à base real: ele
consome o adapter em `collaborators.js`. Dois caminhos:

**A) Push do SGI → módulo (pronto):** o SGI chama
`POST /collaborators/import` (job agendado ou webhook). `importFromSGI()` faz
upsert por e-mail e aplica a trava de domínio.

**B) Pull direto da base do SGI (reescrever o adapter):** trocar o corpo de
`listCollaborators()` / `getCollaborator()` para consultar a tabela real de
colaboradores do SGI, em vez da tabela local. A assinatura (retorno com
`id, name, email, department, cargo, active`) deve ser mantida — o resto do
módulo não muda.

Em ambos, a **trava de domínio** (`ALLOWED_DOMAIN`) continua valendo: só entram
alvos `@grupoclube.com.br`, barrando disparo para fora da empresa.

---

## 7. Da simulação para produção (checklist)

- [ ] **Segredos por ambiente:** `ADMIN_PASS`, `COOKIE_SECRET`, `IMPORT_API_KEY`
      saem de `process.env` (nunca dos defaults do `config.js`).
- [ ] **Auth do painel:** trocar o login fixo `admin/admin` pelo SSO/auth do SGI
      (o `preHandler` em `module.js:253` é o ponto único a adaptar).
- [ ] **Fonte de colaboradores:** ligar o adapter à base real (seção 6).
- [ ] **SMTP real:** setar `SMTP_HOST`/etc. (SES, Postmark…) para envio de verdade.
- [ ] **Scheduler:** trocar o `setInterval` em processo (`module.js:472`) por
      **BullMQ + Redis** com `repeat` — resiliente a restart e múltiplas instâncias.
- [ ] **Banco:** para produção com várias instâncias, trocar `node:sqlite` por
      Postgres/MySQL do SGI. A camada está isolada em `db.js`; as queries são SQL
      padrão. Avaliar também sair do flag `--experimental-sqlite`.
- [ ] **Tracking em domínio separado** do SGI (isola cookies/sessão do app real).
- [ ] **Expurgo LGPD:** agendar `npm run purge` (retenção via `RETENTION_DAYS`).

---

## 8. Guardrails (não remover — mantêm isto como treino, não ataque)

1. **Sem captura de senha** — `events` não tem coluna de senha; `POST
   /t/:token/submit` **descarta o corpo** (`module.js:430`).
2. **Marca interna genérica** — não clonar marcas de terceiros nos templates.
3. **Trava de domínio** — só alvos `@ALLOWED_DOMAIN`, no import e na criação de
   campanha (`module.js:114`, `collaborators.js:36`).
4. **Autorização registrada** — campo "Autorizado por" obrigatório + auditoria.
5. **Página educativa + reporte premiado** — foco em ensinar, não punir.

---

## 9. Rodar localmente (dev)

```bash
npm install
npm run seed     # colaboradores fictícios + 1 template
npm start        # http://localhost:3000 -> /eng-social

# utilitários
npm run reset    # zera e repopula o banco
npm run purge    # expurgo LGPD (retenção)
```

Login: `admin / admin`. Caixa de saída (e-mails em modo dev):
`/eng-social/inbox`.
