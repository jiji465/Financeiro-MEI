// Rotas /api/v1/contatos (contexto já autenticado pelo registry: request.tenantId disponível).
// Schemas: @meifin/shared/schemas/contatos (+ listaLancamentosResponse do módulo lancamentos).
import {
  atualizarContatoBody,
  contatoLancamentosQuery,
  contatoResponse,
  contatoResumoResponse,
  criarContatoBody,
  errorResponse,
  idParam,
  listaContatosResponse,
  listaLancamentosResponse,
  listarContatosQuery,
  okResponse,
  opcoesContatosQuery,
  opcoesContatosResponse,
} from '@meifin/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { forTenant } from '../../lib/tenant-db.js';
import * as service from './service.js';

const TAGS = ['contatos'];

export const contatosRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '',
    {
      schema: {
        tags: TAGS,
        summary: 'Lista clientes e fornecedores (paginado; padrão: só ativos)',
        querystring: listarContatosQuery,
        response: { 200: listaContatosResponse, 400: errorResponse, 401: errorResponse },
      },
    },
    async (request) => service.listar(forTenant(app.db, request.tenantId), request.query),
  );

  app.get(
    '/opcoes',
    {
      schema: {
        tags: TAGS,
        summary: 'Lista enxuta de contatos ativos para seletores',
        querystring: opcoesContatosQuery,
        response: { 200: opcoesContatosResponse, 400: errorResponse, 401: errorResponse },
      },
    },
    async (request) => ({
      data: await service.opcoes(forTenant(app.db, request.tenantId), request.query),
    }),
  );

  app.post(
    '',
    {
      schema: {
        tags: TAGS,
        summary: 'Cria contato (CPF/CNPJ validado e único por MEI)',
        body: criarContatoBody,
        response: { 201: contatoResponse, 400: errorResponse, 409: errorResponse },
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
        summary: 'Detalhe do contato',
        params: idParam,
        response: { 200: contatoResponse, 404: errorResponse },
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
        summary: 'Atualiza contato',
        params: idParam,
        body: atualizarContatoBody,
        response: {
          200: contatoResponse,
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
        summary: 'Exclui contato (soft delete; lançamentos vinculados são mantidos)',
        params: idParam,
        response: { 200: okResponse, 404: errorResponse },
      },
    },
    async (request) => {
      await service.excluir(forTenant(app.db, request.tenantId), request.params.id);
      return { data: { ok: true as const } };
    },
  );

  app.get(
    '/:id/lancamentos',
    {
      schema: {
        tags: TAGS,
        summary: 'Histórico de lançamentos do contato (?de&ate&page)',
        params: idParam,
        querystring: contatoLancamentosQuery,
        response: { 200: listaLancamentosResponse, 400: errorResponse, 404: errorResponse },
      },
    },
    async (request) =>
      service.listarLancamentos(
        forTenant(app.db, request.tenantId),
        request.params.id,
        request.query,
      ),
  );

  app.get(
    '/:id/resumo',
    {
      schema: {
        tags: TAGS,
        summary: 'Resumo financeiro do contato (totais, a receber/pagar, atrasados, notas)',
        params: idParam,
        response: { 200: contatoResumoResponse, 404: errorResponse },
      },
    },
    async (request) => ({
      data: await service.resumo(
        forTenant(app.db, request.tenantId),
        request.params.id,
        app.hoje(),
      ),
    }),
  );
};
