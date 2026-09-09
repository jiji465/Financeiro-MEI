// Módulo dashboard (WP5): rotas em routes.ts, regras em service.ts, consultas em repository.ts.
// Somente leitura. Observação para o integrador: antes de responder o dashboard, as
// recorrências pendentes devem ser materializadas (WP2 exporta `gerarRecorrenciasPendentes`);
// a chamada é ligada na Phase 3 (ver docs/handoff/WP5.md) para não criar dependência entre WPs.
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { dashboardRoutes } from './routes.js';

export const dashboardModule: FastifyPluginAsyncZod = async (app) => {
  await app.register(dashboardRoutes);
};

export { situacaoLimiteDoTenant, resolverPeriodo, periodoAnterior } from './service.js';
