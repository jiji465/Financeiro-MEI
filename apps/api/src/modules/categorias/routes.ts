// Rotas /api/v1/categorias (contexto já autenticado pelo registry: request.tenantId disponível).
// Schemas: @meifin/shared/schemas/categorias.
import {
  atualizarCategoriaBody,
  categoriaResponse,
  criarCategoriaBody,
  errorResponse,
  excluirCategoriaResponse,
  idParam,
  listaCategoriasResponse,
  listarCategoriasQuery,
} from '@meifin/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { forTenant } from '../../lib/tenant-db.js';
import * as service from './service.js';

const TAGS = ['categorias'];

export const categoriasRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '',
    {
      schema: {
        tags: TAGS,
        summary: 'Lista categorias do MEI (padrão: só ativas)',
        querystring: listarCategoriasQuery,
        response: { 200: listaCategoriasResponse, 401: errorResponse },
      },
    },
    async (request) => ({
      data: await service.listar(forTenant(app.db, request.tenantId), request.query),
    }),
  );

  app.post(
    '',
    {
      schema: {
        tags: TAGS,
        summary: 'Cria categoria',
        body: criarCategoriaBody,
        response: { 201: categoriaResponse, 400: errorResponse, 409: errorResponse },
      },
    },
    async (request, reply) => {
      const data = await service.criar(forTenant(app.db, request.tenantId), request.body);
      return reply.status(201).send({ data });
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        tags: TAGS,
        summary: 'Detalhe da categoria',
        params: idParam,
        response: { 200: categoriaResponse, 404: errorResponse },
      },
    },
    async (request) => ({
      data: await service.obter(forTenant(app.db, request.tenantId), request.params.id),
    }),
  );

  app.patch(
    '/:id',
    {
      schema: {
        tags: TAGS,
        summary: 'Atualiza categoria (tipo não muda; sistema não desativa)',
        params: idParam,
        body: atualizarCategoriaBody,
        response: {
          200: categoriaResponse,
          400: errorResponse,
          404: errorResponse,
          409: errorResponse,
        },
      },
    },
    async (request) => ({
      data: await service.atualizar(
        forTenant(app.db, request.tenantId),
        request.params.id,
        request.body,
      ),
    }),
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: TAGS,
        summary: 'Exclui categoria (ou só desativa, se estiver em uso); sistema → 409',
        params: idParam,
        response: { 200: excluirCategoriaResponse, 404: errorResponse, 409: errorResponse },
      },
    },
    async (request) => ({
      data: await service.excluir(forTenant(app.db, request.tenantId), request.params.id),
    }),
  );
};
