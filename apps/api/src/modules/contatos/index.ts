// Módulo contatos (WP1): rotas em routes.ts, regras em service.ts, acesso a dados em repository.ts.
// O plugin recebe a instância já com o type provider zod; usa app.db / app.hoje / request.tenantId.
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { contatosRoutes } from './routes.js';

export const contatosModule: FastifyPluginAsyncZod = async (app) => {
  await app.register(contatosRoutes);
};

export { toContatoDto, toContatoOpcaoDto } from './service.js';
