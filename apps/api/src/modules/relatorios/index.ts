// Módulo relatorios (WP5): rotas em routes.ts, regras em service.ts, consultas em repository.ts,
// exportação CSV/PDF em exportar.ts. Somente leitura.
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { relatoriosRoutes } from './routes.js';

export const relatoriosModule: FastifyPluginAsyncZod = async (app) => {
  await app.register(relatoriosRoutes);
};
