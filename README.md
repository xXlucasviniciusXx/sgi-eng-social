# SGI · Módulo de Engenharia Social

Módulo de **simulação de phishing para conscientização interna**, construído para ser
**plugado no SGI** como um plugin Fastify. Mede quem abre, clica, envia o formulário —
e quem **reporta** (o comportamento certo) — para treinar a equipe, **não** para capturar
credenciais.

## Como rodar (standalone)

```bash
npm install
npm run seed          # colaboradores ficticios + 1 template
npm start             # http://localhost:3000  (redireciona para /eng-social)
```

Login padrão: **admin / admin** (troque em produção via `ADMIN_USER` / `ADMIN_PASS`).

- **Painel:** http://localhost:3000/eng-social/
- **Caixa de saída (dev):** http://localhost:3000/eng-social/inbox

## Integração como módulo do SGI

O módulo é um **plugin Fastify** montado sob um prefixo:

```js
import engSocial from './eng-social/src/module.js';
app.register(engSocial, { prefix: '/eng-social' });
```

Ele registra o que precisa (formbody, cookie), cria/migra suas tabelas e serve três
superfícies: **painel admin**, **tracking público** e **sync de colaboradores**.

**Fonte de colaboradores desacoplada** (`src/collaborators.js`): no MVP vêm da tabela
local; em produção o SGI sincroniza a base real:

```bash
POST /eng-social/collaborators/import
Header: x-api-key: <IMPORT_API_KEY>
Body:  { "people": [ { "ext_id", "name", "email", "department", "cargo" } ] }
```

A trava de domínio (`ALLOWED_DOMAIN`) é aplicada no import e na criação de alvos.

## Funcionalidades

**Campanhas** — criar, **agendar** (data futura), **recorrência** mensal/quinzenal,
disparar, **clonar**, excluir. Seleção de alvos com **filtros por setor e cargo**.

**Templates** — CRUD completo, **dificuldade** (fácil/médio/difícil), prévia, validação
de placeholders.

**Treinamento** — botão **"Reportar phishing"** (registra o acerto), **quiz pós-clique**,
página educativa.

**Análise** — relatório por campanha (funil + por colaborador), **Insights** consolidados
(por setor, por cargo, **reincidentes**, **ranking de quem reportou**), **tempo médio até
o clique**, **export CSV**.

**Governança** — **login** no painel, **trilha de auditoria**, **expurgo LGPD**
(`npm run purge`), agregados anônimos nos Insights.

**Envio de e-mail** — Nodemailer. Sem SMTP configurado, roda em modo dev (Caixa de saída).
Com `SMTP_HOST`, envia de verdade.

## Modelagem (`src/db.js`)

| Tabela | Papel |
|---|---|
| `collaborators` | base de pessoas (local ou sincronizada do SGI) |
| `templates` | e-mail isca + página simulada + dificuldade |
| `campaigns` | cada disparo isolado; status draft/scheduled/running/done |
| `campaign_targets` | quem recebeu o quê, com `token` único (URL rastreável) |
| `events` | **append-only**: opened/clicked/submitted/reported/training_completed |
| `audit_log` | quem fez o quê no painel |

## Guardrails (o que mantém isto como treino, não ataque)

1. **Sem captura de senha** — `events` não tem coluna de senha; `POST /t/:token/submit`
   **descarta o corpo**. *(verificado: senha enviada no teste não aparece no banco.)*
2. **Marca interna genérica** — não clonamos marcas de terceiros.
3. **Trava de domínio** — só alvos `@ALLOWED_DOMAIN`, no import e na criação de campanha.
4. **Autorização registrada** — campo "Autorizado por" obrigatório + trilha de auditoria.
5. **Página educativa + reporte premiado** — foco em ensinar, não punir.

## Variáveis de ambiente

| Var | Padrão | Função |
|---|---|---|
| `PORT` | 3000 | porta |
| `BASE_PATH` | `/eng-social` | prefixo de montagem |
| `ALLOWED_DOMAIN` | `grupoclube.com.br` | trava de domínio |
| `PUBLIC_BASE_URL` | `http://localhost:PORT` | base dos links rastreados |
| `ADMIN_USER` / `ADMIN_PASS` | admin / admin | login do painel |
| `COOKIE_SECRET` | (dev) | assinatura do cookie de sessão |
| `IMPORT_API_KEY` | `dev-key` | chave do endpoint de sync |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM` | — | envio real |
| `RETENTION_DAYS` | 180 | retenção do expurgo LGPD |

## Scripts

- `npm start` — sobe o servidor standalone
- `npm run seed` — popula dados fictícios
- `npm run reset` — zera e repopula o banco
- `npm run purge` — expurga campanhas/eventos além da retenção (LGPD)

## Da simulação para produção

- Trocar o seed pela sincronização real do SGI (endpoint de import já pronto).
- Configurar SMTP (SES/Postmark) para envio real.
- Trocar o scheduler em processo por **BullMQ + Redis** (filas com `repeat`).
- Hospedar o tracking em **domínio separado** do SGI.
- Trocar `COOKIE_SECRET`, `ADMIN_PASS` e `IMPORT_API_KEY`.
