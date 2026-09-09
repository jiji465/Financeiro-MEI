import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { solicitacoesRoutes } from './routes.js';

export const solicitacoesModule: FastifyPluginAsyncZod = async (app) => {
  await app.register(solicitacoesRoutes);
};
