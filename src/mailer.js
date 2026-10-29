// Envio de e-mail. Se SMTP estiver configurado (config.SMTP.host), envia de verdade
// via Nodemailer. Caso contrario, roda em modo "dev": nao envia, apenas marca como
// enviado para aparecer na Caixa de saida simulada.

import nodemailer from 'nodemailer';
import { SMTP } from './config.js';

export const isLive = Boolean(SMTP.host);

let transporter = null;
if (isLive) {
  transporter = nodemailer.createTransport({
    host: SMTP.host,
    port: SMTP.port,
    secure: SMTP.port === 465,
    auth: SMTP.user ? { user: SMTP.user, pass: SMTP.pass } : undefined,
  });
}

export async function sendMail({ to, subject, html }) {
  if (!isLive) return { dev: true }; // modo simulado: Caixa de saida cuida da exibicao
  return transporter.sendMail({ from: SMTP.from, to, subject, html });
}
