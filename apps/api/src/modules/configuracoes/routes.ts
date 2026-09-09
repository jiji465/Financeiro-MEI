// Rotas /api/v1/configuracoes (contexto autenticado). Schemas: @meifin/shared/schemas/configuracoes.
import { atualizarConfiguracoesBody, configuracoesResponse, errorResponse } from '@meifin/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import * as service from './service.js';

const TAGS = ['configuracoes'];

export const configuracoesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '',
    {
      schema: {
        tags: TAGS,
        summary: 'Dados do MEI e preferências',
        response: { 200: configuracoesResponse, 401: errorResponse },
      },
    },
    async (request) => ({ data: await service.obter(app.db, request.tenantId) }),
  );

  app.patch(
    '',
    {
      schema: {
        tags: TAGS,
        summary: 'Atualiza dados do MEI (mei.*) e preferências',
        body: atualizarConfiguracoesBody,
        response: {
          200: configuracoesResponse,
          400: errorResponse,
          404: errorResponse,
          409: errorResponse,
          422: errorResponse,
        },
      },
    },
    async (request) => ({
      data: await app.database.withTx((tx) =>
        service.atualizar(tx, request.tenantId, request.body),
      ),
    }),
  );
};
