// Rotas /api/v1/lancamentos (prefixo do módulo é '' — caminhos completos aqui).
// Schemas: @meifin/shared/schemas/lancamentos. Contexto já autenticado (request.tenantId).
import {
  atualizarLancamentoBody,
  criarLancamentoBody,
  errorResponse,
  idParam,
  lancamentoResponse,
  listaLancamentosResponse,
  listarLancamentosQuery,
  pagarLancamentoBody,
  resumoLancamentosQuery,
  resumoLancamentosResponse,
} from '@meifin/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { exigirArquivo, lerMultipart } from './multipart.js';
import * as service from './service.js';
import type { LancamentosCtx } from './service.js';

const TAGS = ['lancamentos'];
const BASE = '/lancamentos';

export function ctxDe(app: FastifyInstance, request: FastifyRequest): LancamentosCtx {
  return {
    tenantId: request.tenantId,
    exec: app.db,
    withTx: (fn) => app.database.withTx(fn),
    hoje: app.hoje,
    storage: app.storage,
  };
}

function contentDisposition(nome: string): string {
  const ascii = nome.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}

export const lancamentosRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    BASE,
    {
      schema: {
        tags: TAGS,
        summary: 'Lista lançamentos com filtros, paginação e totais do filtro',
        querystring: listarLancamentosQuery,
        response: { 200: listaLancamentosResponse, 400: errorResponse, 401: errorResponse },
      },
    },
    async (request) => service.listar(ctxDe(app, request), request.query),
  );

  app.get(
    `${BASE}/resumo`,
    {
      schema: {
        tags: TAGS,
        summary: 'Totais de receitas/despesas (pagos e pendentes) no período',
        querystring: resumoLancamentosQuery,
        response: { 200: resumoLancamentosResponse, 400: errorResponse },
      },
    },
    async (request) => ({ data: await service.resumo(ctxDe(app, request), request.query) }),
  );

  app.post(
    BASE,
    {
      schema: {
        tags: TAGS,
        summary: 'Cria lançamento (com recorrência opcional)',
        body: criarLancamentoBody,
        response: {
          201: lancamentoResponse,
          400: errorResponse,
          404: errorResponse,
          422: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const data = await service.criar(ctxDe(app, request), request.body);
      return reply.status(201).send({ data });
    },
  );

  app.get(
    `${BASE}/:id`,
    {
      schema: {
        tags: TAGS,
        summary: 'Detalhe do lançamento',
        params: idParam,
        response: { 200: lancamentoResponse, 404: errorResponse },
      },
    },
    async (request) => ({
      data: await service.obter(ctxDe(app, request), request.params.id),
    }),
  );

  app.patch(
    `${BASE}/:id`,
    {
      schema: {
        tags: TAGS,
        summary: 'Atualiza lançamento (origem das/baixa: só descrição e observações)',
        params: idParam,
        body: atualizarLancamentoBody,
        response: {
          200: lancamentoResponse,
          400: errorResponse,
          404: errorResponse,
          422: errorResponse,
        },
      },
    },
    async (request) => ({
      data: await service.atualizar(ctxDe(app, request), request.params.id, request.body),
    }),
  );

  app.delete(
    `${BASE}/:id`,
    {
      schema: {
        tags: TAGS,
        summary: 'Exclui lançamento (soft delete); vinculado a parcela/DAS → 422',
        params: idParam,
        response: { 204: z.null(), 404: errorResponse, 422: errorResponse },
      },
    },
    async (request, reply) => {
      await service.excluir(ctxDe(app, request), request.params.id);
      return reply.status(204).send(null);
    },
  );

  app.post(
    `${BASE}/:id/pagar`,
    {
      schema: {
        tags: TAGS,
        summary: 'Marca como pago (data de pagamento padrão: hoje)',
        params: idParam,
        body: pagarLancamentoBody,
        response: { 200: lancamentoResponse, 404: errorResponse, 409: errorResponse },
      },
    },
    async (request) => ({
      data: await service.pagar(ctxDe(app, request), request.params.id, request.body),
    }),
  );

  app.post(
    `${BASE}/:id/anexo`,
    {
      schema: {
        tags: TAGS,
        summary: 'Envia anexo (multipart, campo "arquivo"; PDF/JPG/PNG/XML ≤ 10 MB)',
        params: idParam,
        consumes: ['multipart/form-data'],
        response: {
          200: lancamentoResponse,
          400: errorResponse,
          404: errorResponse,
          413: errorResponse,
        },
      },
    },
    async (request) => {
      const ctx = ctxDe(app, request);
      const lido = await lerMultipart(request);
      const arquivo = exigirArquivo(lido);
      return { data: await service.salvarAnexo(ctx, request.params.id, arquivo) };
    },
  );

  app.get(
    `${BASE}/:id/anexo`,
    {
      schema: {
        tags: TAGS,
        summary: 'Baixa o anexo (conteúdo binário com o content-type original)',
        params: idParam,
        produces: ['application/pdf', 'image/jpeg', 'image/png', 'application/xml'],
      },
    },
    async (request, reply) => {
      const anexo = await service.lerAnexo(ctxDe(app, request), request.params.id);
      return reply
        .type(anexo.mime)
        .header('content-length', String(anexo.tamanho))
        .header('content-disposition', contentDisposition(anexo.nome))
        .header('cache-control', 'private, max-age=0')
        .send(anexo.conteudo);
    },
  );

  app.delete(
    `${BASE}/:id/anexo`,
    {
      schema: {
        tags: TAGS,
        summary: 'Remove o anexo',
        params: idParam,
        response: { 204: z.null(), 404: errorResponse },
      },
    },
    async (request, reply) => {
      await service.removerAnexo(ctxDe(app, request), request.params.id);
      return reply.status(204).send(null);
    },
  );
};
