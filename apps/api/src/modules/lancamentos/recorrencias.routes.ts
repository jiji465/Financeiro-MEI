// Rotas /api/v1/recorrencias (CRUD + POST /gerar). Schemas: @meifin/shared/schemas/lancamentos.
import {
  atualizarRecorrenciaBody,
  criarRecorrenciaBody,
  errorResponse,
  gerarRecorrenciasBody,
  gerarRecorrenciasResponse,
  idParam,
  listaRecorrenciasResponse,
  listarRecorrenciasQuery,
  recorrenciaResponse,
} from '@meifin/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { forTenant } from '../../lib/tenant-db.js';
import * as service from './recorrencias.service.js';

const TAGS = ['recorrencias'];
const BASE = '/recorrencias';

export const recorrenciasRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    BASE,
    {
      schema: {
        tags: TAGS,
        summary: 'Lista recorrências do MEI',
        querystring: listarRecorrenciasQuery,
        response: { 200: listaRecorrenciasResponse, 401: errorResponse },
      },
    },
    async (request) => ({
      data: await service.listar(forTenant(app.db, request.tenantId), request.query),
    }),
  );

  app.post(
    BASE,
    {
      schema: {
        tags: TAGS,
        summary: 'Cria recorrência e materializa as competências pendentes até hoje',
        body: criarRecorrenciaBody,
        response: {
          201: recorrenciaResponse,
          400: errorResponse,
          404: errorResponse,
          422: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const data = await app.database.withTx((tx) =>
        service.criar(forTenant(tx, request.tenantId), app.hoje(), request.body),
      );
      return reply.status(201).send({ data });
    },
  );

  app.post(
    `${BASE}/gerar`,
    {
      schema: {
        tags: TAGS,
        summary: 'Materializa lançamentos pendentes das recorrências (idempotente)',
        body: gerarRecorrenciasBody.optional(),
        response: { 200: gerarRecorrenciasResponse, 404: errorResponse },
      },
    },
    async (request) => ({
      data: await app.database.withTx((tx) =>
        service.gerar(forTenant(tx, request.tenantId), app.hoje(), request.body ?? {}),
      ),
    }),
  );

  app.get(
    `${BASE}/:id`,
    {
      schema: {
        tags: TAGS,
        summary: 'Detalhe da recorrência',
        params: idParam,
        response: { 200: recorrenciaResponse, 404: errorResponse },
      },
    },
    async (request) => ({
      data: await service.obter(forTenant(app.db, request.tenantId), request.params.id),
    }),
  );

  app.patch(
    `${BASE}/:id`,
    {
      schema: {
        tags: TAGS,
        summary: 'Atualiza recorrência (pausar/reativar via ativo)',
        params: idParam,
        body: atualizarRecorrenciaBody,
        response: {
          200: recorrenciaResponse,
          400: errorResponse,
          404: errorResponse,
          422: errorResponse,
        },
      },
    },
    async (request) => ({
      data: await app.database.withTx((tx) =>
        service.atualizar(
          forTenant(tx, request.tenantId),
          app.hoje(),
          request.params.id,
          request.body,
        ),
      ),
    }),
  );

  app.delete(
    `${BASE}/:id`,
    {
      schema: {
        tags: TAGS,
        summary: 'Exclui recorrência (lançamentos já gerados permanecem)',
        params: idParam,
        response: { 204: z.null(), 404: errorResponse },
      },
    },
    async (request, reply) => {
      await service.excluir(forTenant(app.db, request.tenantId), request.params.id);
      return reply.status(204).send(null);
    },
  );
};
