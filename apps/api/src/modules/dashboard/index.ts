// Preenchido por WP5 (Dashboard + Relatórios): rotas em routes.ts, regras em service.ts, acesso a dados em repository.ts.
// O plugin recebe a instância já com o type provider zod; use app.db / app.env / request.tenantId.
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

export const dashboardModule: FastifyPluginAsyncZod = async (_app) => {
  // stub do Phase 0
};
