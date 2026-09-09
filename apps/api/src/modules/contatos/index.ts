// Preenchido por WP1 (Contatos): rotas em routes.ts, regras em service.ts, acesso a dados em repository.ts.
// O plugin recebe a instância já com o type provider zod; use app.db / app.env / request.tenantId.
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

export const contatosModule: FastifyPluginAsyncZod = async (_app) => {
  // stub do Phase 0
};
