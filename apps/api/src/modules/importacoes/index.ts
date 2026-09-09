// Módulo importações (WP2): preview/confirmação de CSV e histórico. Prefixo /importacoes.
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { importacoesRoutes } from './routes.js';

export const importacoesModule: FastifyPluginAsyncZod = async (app) => {
  await app.register(importacoesRoutes);
};

export { hashLinha, interpretarCsv, sugerirCategoria } from './service.js';
