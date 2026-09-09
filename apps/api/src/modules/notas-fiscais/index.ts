// Módulo notas-fiscais: rotas em routes.ts, regras em service.ts, acesso a dados em repository.ts,
// provedores de emissão (manual hoje; SEFAZ no futuro) em providers/.
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { notasFiscaisRoutes } from './routes.js';

export const notasFiscaisModule: FastifyPluginAsyncZod = async (app) => {
  await app.register(notasFiscaisRoutes);
};

export type { NfeProvider } from './providers/index.js';
export { ManualProvider, obterProvider } from './providers/index.js';
