// Rotas /api/v1/produtos-servicos (contexto já autenticado pelo registry: request.tenantId).
// Schemas: @meifin/shared/schemas/produtos-servicos.
import {
  atualizarProdutoServicoBody,
  criarProdutoServicoBody,
  errorResponse,
  excluirProdutoServicoResponse,
  idParam,
  listaProdutosServicosResponse,
  listarProdutosServicosQuery,
  opcoesProdutosServicosResponse,
  produtoServicoResponse,
  TIPOS_PRODUTO_SERVICO,
} from '@meifin/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { forTenant } from '../../lib/tenant-db.js';
import * as service from './service.js';

const TAGS = ['produtos-servicos'];

const opcoesQuery = z.object({ tipo: z.enum(TIPOS_PRODUTO_SERVICO).optional() });

export const produtosServicosRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '',
    {
      schema: {
        tags: TAGS,
        summary: 'Lista o catálogo de produtos e serviços (?tipo, ?ativo, ?busca)',
        querystring: listarProdutosServicosQuery,
        response: { 200: listaProdutosServicosResponse, 400: errorResponse, 401: errorResponse },
      },
    },
    async (request) => ({
      data: await service.listar(forTenant(app.db, request.tenantId), request.query),
    }),
  );

  app.get(
    '/opcoes',
    {
      schema: {
        tags: TAGS,
        summary: 'Lista enxuta do catálogo ativo para o seletor de itens',
        querystring: opcoesQuery,
        response: { 200: opcoesProdutosServicosResponse, 401: errorResponse },
      },
    },
    async (request) => ({
      data: await service.opcoes(forTenant(app.db, request.tenantId), request.query.tipo),
    }),
  );

  app.post(
    '',
    {
      schema: {
        tags: TAGS,
        summary: 'Cadastra produto ou serviço (nome único por MEI)',
        body: criarProdutoServicoBody,
        response: { 201: produtoServicoResponse, 400: errorResponse, 409: errorResponse },
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
        summary: 'Detalhe do produto ou serviço',
        params: idParam,
        response: { 200: produtoServicoResponse, 404: errorResponse },
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
        summary: 'Atualiza produto ou serviço (inclusive ativar/desativar)',
        params: idParam,
        body: atualizarProdutoServicoBody,
        response: {
          200: produtoServicoResponse,
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
        summary: 'Exclui do catálogo (soft delete; as vendas já registradas são mantidas)',
        params: idParam,
        response: { 200: excluirProdutoServicoResponse, 404: errorResponse },
      },
    },
    async (request) => {
      await service.excluir(forTenant(app.db, request.tenantId), request.params.id);
      return { data: { ok: true as const } };
    },
  );
};
