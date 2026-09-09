// Módulo categorias: rotas em routes.ts, regras em service.ts, acesso a dados em repository.ts,
// helpers para outros módulos em core.ts (getCategoriaSistema).
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { categoriasRoutes } from './routes.js';

export const categoriasModule: FastifyPluginAsyncZod = async (app) => {
  await app.register(categoriasRoutes);
};

export { getCategoriaSistema } from './core.js';
