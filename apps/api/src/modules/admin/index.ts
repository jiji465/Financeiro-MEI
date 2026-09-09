import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { adminRoutes } from './routes.js';

export const adminModule: FastifyPluginAsyncZod = async (app) => {
  await app.register(adminRoutes);
};
