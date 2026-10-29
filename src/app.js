// Servidor standalone para rodar o modulo localmente.
// No SGI real, este arquivo nao e usado: o SGI faz app.register(engSocial, { prefix }).

import Fastify from 'fastify';
import engSocial from './module.js';
import { PORT, BASE_PATH, PUBLIC_BASE_URL, ADMIN_USER } from './config.js';

const app = Fastify({ logger: false });

// Conveniencia: raiz redireciona para o modulo.
app.get('/', (req, reply) => reply.redirect(BASE_PATH + '/'));

await app.register(engSocial, { prefix: BASE_PATH });

app.listen({ port: PORT, host: '0.0.0.0' }).then(() => {
  console.log(`\n  SGI · Modulo Eng. Social em ${PUBLIC_BASE_URL}${BASE_PATH}/`);
  console.log(`  Login: usuario "${ADMIN_USER}" (senha padrao "admin" — troque em producao)\n`);
});
