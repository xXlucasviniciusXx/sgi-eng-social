# Contribuindo

Módulo de conscientização em segurança (simulação de phishing) do SGI. Leia o
**[Guia de Integração](docs/INTEGRACAO.md)** antes de mexer no código.

## Setup

```bash
npm install
npm run seed
npm start        # http://localhost:3000/eng-social  (login: admin/admin)
```

Requer **Node 22.5+** (usa `node:sqlite`). O start já passa os flags
`--experimental-sqlite --disable-warning=ExperimentalWarning`.

## Organização do código

- `src/module.js` — rotas + lógica de negócio (o plugin Fastify).
- `src/db.js` — schema, migrações, helpers (`tx`, `recordEvent`, `audit`).
- `src/collaborators.js` — **adapter** da fonte de pessoas (ponto de integração).
- `src/views.js` — UI (HTML em template literals) e gráficos SVG.
- `src/config.js` — config via `process.env` com defaults de dev.

## Regras que não mudam (guardrails de segurança)

Este é um projeto público e de uso defensivo/educativo. **Não** aceite mudanças
que:

1. **Capturem senhas ou credenciais reais** (`events` não tem coluna de senha; o
   `submit` descarta o corpo — mantenha assim).
2. **Clonem marcas de terceiros** (bancos, provedores, redes sociais). Use marca
   interna genérica.
3. **Removam a trava de domínio** (`ALLOWED_DOMAIN`): só alvos da empresa.
4. **Retirem a autorização obrigatória** ou a trilha de auditoria.

## Convenções

- Sem dependências pesadas novas sem necessidade clara (o MVP é zero-build de
  propósito). Discuta antes de adicionar.
- Migrações de schema: use o helper `migrate(table, column, decl)` em `db.js`
  (idempotente).
- Transações: use `tx(fn)` — `node:sqlite` não tem `.transaction()`.
- Nunca commite `data/`, `.env` ou segredos (já no `.gitignore`).

## Fluxo

1. Crie um branch a partir de `main`.
2. Faça a mudança + teste manual pelo painel/tracking.
3. Abra um PR descrevendo o quê e o porquê. Para mudanças de produção, siga o
   checklist da seção 7 do guia de integração.
