// Módulo titulos (contas a pagar/receber + parcelas). Registrado com prefixo '' no registry:
// as rotas declaram os caminhos completos /titulos… e /parcelas…
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { parcelasRoutes, titulosRoutes } from './routes.js';

export const titulosModule: FastifyPluginAsyncZod = async (app) => {
  await app.register(titulosRoutes);
  await app.register(parcelasRoutes);
};
