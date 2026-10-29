// Popula o banco com dados ficticios para o MVP.
// Em producao, os "collaborators" viriam da base real do SGI (view/import),
// e os templates seriam gerenciados pela tela de administracao.

import { db, initSchema } from './db.js';
import { ALLOWED_DOMAIN } from './config.js';

initSchema();

const already = db.prepare('SELECT COUNT(*) AS n FROM collaborators').get().n;
if (already > 0 && !process.env.FORCE_SEED) {
  console.log(`Banco ja populado (${already} colaboradores). Nada a fazer.`);
  process.exit(0);
}

// --- Colaboradores ficticios (simulando a tabela do SGI) ---------------------
// [nome, usuario, setor, cargo]
const colaboradores = [
  ['Ana Souza', 'ana.souza', 'Financeiro', 'Analista'],
  ['Bruno Lima', 'bruno.lima', 'TI', 'Analista'],
  ['Carla Mendes', 'carla.mendes', 'RH', 'Coordenador'],
  ['Diego Alves', 'diego.alves', 'Comercial', 'Vendedor'],
  ['Elaine Rocha', 'elaine.rocha', 'Financeiro', 'Gerente'],
  ['Felipe Nunes', 'felipe.nunes', 'Operacoes', 'Operador'],
  ['Gabriela Dias', 'gabriela.dias', 'Comercial', 'Gerente'],
  ['Henrique Castro', 'henrique.castro', 'TI', 'Coordenador'],
  ['Isabela Pires', 'isabela.pires', 'RH', 'Analista'],
  ['Joao Pereira', 'joao.pereira', 'Operacoes', 'Supervisor'],
  ['Karina Melo', 'karina.melo', 'Diretoria', 'Diretor'],
  ['Lucas Prado', 'lucas.prado', 'Comercial', 'Vendedor'],
];

const insColab = db.prepare(
  'INSERT OR IGNORE INTO collaborators (name, email, department, cargo) VALUES (?, ?, ?, ?)'
);
for (const [name, user, dept, cargo] of colaboradores) {
  insColab.run(name, `${user}@${ALLOWED_DOMAIN}`, dept, cargo);
}

// --- Template de exemplo -----------------------------------------------------
// GUARDRAIL: marca INTERNA generica. NAO clonamos Facebook, Locaweb, bancos, etc.
const emailHtml = `
  <p>Ola {{name}},</p>
  <p>Identificamos uma pendencia de seguranca na sua conta do <b>Portal Interno Grupo Clube</b>.
  Para evitar o bloqueio do acesso, confirme seus dados em ate 24 horas:</p>
  <p><a href="{{link}}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Revalidar meu acesso</a></p>
  <p style="color:#64748b;font-size:12px">Caso o botao nao funcione, acesse: {{link}}</p>
  <p style="color:#64748b;font-size:12px">Nao reconhece este e-mail? <a href="{{report}}">Reportar como phishing</a></p>
  {{pixel}}
`;

const landingHtml = `
  <h1 style="margin:0 0 4px">Portal Interno · Grupo Clube</h1>
  <p style="color:#64748b;margin:0 0 24px">Revalidacao de acesso</p>
  <!-- O campo de senha NAO tem atributo name: o navegador nao envia o valor.
       Alem disso, o servidor DESCARTA todo o corpo do POST. Nenhuma senha
       real transita ou e armazenada. Registramos apenas o evento. -->
  <form method="POST" action="{{submit}}">
    <label>Usuario</label>
    <input type="text" placeholder="nome.sobrenome" />
    <label>Senha</label>
    <input type="password" placeholder="••••••••" />
    <button type="submit">Entrar</button>
  </form>
`;

db.prepare(
  'INSERT INTO templates (name, subject, email_html, landing_html) VALUES (?, ?, ?, ?)'
).run(
  'Revalidacao de acesso (Portal Interno)',
  '[Acao necessaria] Revalide seu acesso ao Portal Interno',
  emailHtml,
  landingHtml
);

console.log(`Seed concluido: ${colaboradores.length} colaboradores + 1 template.`);
