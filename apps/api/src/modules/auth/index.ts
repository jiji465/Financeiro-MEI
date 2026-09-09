// Módulo auth: rotas em routes.ts, regras em service.ts, acesso a dados em repository.ts.
// Registrado sem o hook global de autenticação; /me e /me/senha usam onRequest: [app.authenticate].
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { authRoutes } from './routes.js';

export const authModule: FastifyPluginAsyncZod = async (app) => {
  await app.register(authRoutes);
};

export { REFRESH_COOKIE, REFRESH_COOKIE_PATH } from './routes.js';
