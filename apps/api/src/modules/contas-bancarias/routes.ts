// Rotas /api/v1/contas-bancarias (contexto já autenticado pelo registry: request.tenantId).
// Schemas: @meifin/shared/schemas/contas-bancarias.
import {
  atualizarContaBancariaBody,
  contaBancariaResponse,
  criarContaBancariaBody,
  errorResponse,
  excluirContaBancariaResponse,
  idParam,
  listaContasBancariasResponse,
  listarContasBancariasQuery,
  opcoesContasBancariasResponse,
} from '@meifin/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { forTenant } from '../../lib/tenant-db.js';
import * as service from './service.js';

const TAGS = ['contas-bancarias'];

export const contasBancariasRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '',
    {
      schema: {
        tags: TAGS,
        summary: 'Lista contas bancárias com saldo calculado (?ativo)',
        querystring: listarContasBancariasQuery,
        response: { 200: listaContasBancariasResponse, 400: errorResponse, 401: errorResponse },
      },
    },
    async (request) => service.listar(forTenant(app.db, request.tenantId), request.query),
  );

  app.get(
    '/opcoes',
    {
      schema: {
        tags: TAGS,
        summary: 'Lista enxuta de contas ativas para seletores',
        response: { 200: opcoesContasBancariasResponse, 401: errorResponse },
      },
    },
    async (request) => ({ data: await service.opcoes(forTenant(app.db, request.tenantId)) }),
  );

  app.post(
    '',
    {
      schema: {
        tags: TAGS,
        summary: 'Cadastra conta bancária (nome único por MEI)',
        body: criarContaBancariaBody,
        response: { 201: contaBancariaResponse, 400: errorResponse, 409: errorResponse },
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
        summary: 'Detalhe da conta bancária com saldo',
        params: idParam,
        response: { 200: contaBancariaResponse, 404: errorResponse },
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
        summary: 'Atualiza conta bancária',
        params: idParam,
        body: atualizarContaBancariaBody,
        response: {
          200: contaBancariaResponse,
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
        summary: 'Exclui conta bancária (soft delete; lançamentos vinculados são mantidos)',
        params: idParam,
        response: { 200: excluirContaBancariaResponse, 404: errorResponse },
      },
    },
    async (request) => {
      await service.excluir(forTenant(app.db, request.tenantId), request.params.id);
      return { data: { ok: true as const } };
    },
  );
};
