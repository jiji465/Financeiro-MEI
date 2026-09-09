// Módulo obrigações (WP4): DAS mensal, DASN-SIMEI, limite anual, calendário e alertas.
// Rotas em routes.ts, regras em service.ts (chamando @meifin/shared/domain), dados em repository.ts.
// Os alertas vivem em /obrigacoes/alertas (o registry monta tudo sob o prefixo /obrigacoes).
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { obrigacoesRoutes } from './routes.js';

export const obrigacoesModule: FastifyPluginAsyncZod = async (app) => {
  await app.register(obrigacoesRoutes);
};
