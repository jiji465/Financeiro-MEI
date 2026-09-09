// Módulo configuracoes: rotas em routes.ts, regras em service.ts, acesso a dados em repository.ts.
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { configuracoesRoutes } from './routes.js';

export const configuracoesModule: FastifyPluginAsyncZod = async (app) => {
  await app.register(configuracoesRoutes);
};
