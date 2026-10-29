// Configuracao central do modulo.
// Em producao, mova estes valores para variaveis de ambiente (.env).

export const PORT = Number(process.env.PORT ?? 3000);

// Prefixo de montagem do modulo dentro do SGI.
// O SGI registra o plugin assim:  app.register(engSocial, { prefix: BASE_PATH })
// Troque para '' se quiser montar na raiz.
export const BASE_PATH = process.env.BASE_PATH ?? '/eng-social';

// GUARDRAIL 1: trava de dominio. So cria alvos para e-mails deste dominio.
export const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN ?? 'grupoclube.com.br';

// Base publica usada para montar os links rastreados.
// Em producao, use um DOMINIO SEPARADO do SGI para o servico de tracking.
export const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ?? `http://localhost:${PORT}`;

// Caminho do banco SQLite.
export const DB_PATH = process.env.DB_PATH ?? 'data/app.db';

// --- Autenticacao do painel admin -------------------------------------------
export const ADMIN_USER = process.env.ADMIN_USER ?? 'admin';
export const ADMIN_PASS = process.env.ADMIN_PASS ?? 'admin';
// Segredo para assinar o cookie de sessao. TROQUE em producao.
export const COOKIE_SECRET = process.env.COOKIE_SECRET ?? 'troque-este-segredo-em-producao-123456';

// --- Envio de e-mail ---------------------------------------------------------
// Se SMTP_HOST estiver definido, envia de verdade (Nodemailer).
// Caso contrario, usa a "Caixa de saida (dev)" e nao envia nada.
export const SMTP = {
  host: process.env.SMTP_HOST ?? null,
  port: Number(process.env.SMTP_PORT ?? 587),
  user: process.env.SMTP_USER ?? null,
  pass: process.env.SMTP_PASS ?? null,
  from: process.env.MAIL_FROM ?? `Seguranca <no-reply@${ALLOWED_DOMAIN}>`,
};

// --- LGPD / retencao ---------------------------------------------------------
// Dias de retencao padrao para o script de expurgo (npm run purge).
export const RETENTION_DAYS = Number(process.env.RETENTION_DAYS ?? 180);
