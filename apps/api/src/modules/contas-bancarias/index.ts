// Módulo contas-bancarias: rotas em routes.ts, regras em service.ts, acesso a dados em
// repository.ts. O plugin recebe a instância já com o type provider zod; usa app.db / request.tenantId.
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { contasBancariasRoutes } from './routes.js';

export const contasBancariasModule: FastifyPluginAsyncZod = async (app) => {
  await app.register(contasBancariasRoutes);
};

export { toContaBancariaDto, toContaBancariaOpcaoDto } from './service.js';
