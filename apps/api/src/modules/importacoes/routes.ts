// Rotas /api/v1/importacoes: preview (multipart), confirmar, listar, detalhe e desfazer.
import {
  confirmarImportacaoBody,
  desfazerImportacaoResponse,
  errorResponse,
  idParam,
  importacaoResponse,
  listaImportacoesResponse,
  listarImportacoesQuery,
  previewImportacaoCampos,
  previewImportacaoResponse,
} from '@meifin/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { ValidationError } from '../../lib/errors.js';
import { exigirArquivo, lerMultipart } from '../lancamentos/multipart.js';
import * as service from './service.js';
import type { ImportacoesCtx } from './service.js';

const TAGS = ['importacoes'];

function ctxDe(app: FastifyInstance, request: FastifyRequest): ImportacoesCtx {
  return {
    tenantId: request.tenantId,
    exec: app.db,
    withTx: (fn) => app.database.withTx(fn),
  };
}

export const importacoesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/csv/preview',
    {
      schema: {
        tags: TAGS,
        summary:
          'Interpreta um CSV (multipart: campo "arquivo" + campo "mapeamento" em JSON) e devolve as linhas com hash/duplicada/erro',
        consumes: ['multipart/form-data'],
        response: { 200: previewImportacaoResponse, 400: errorResponse, 413: errorResponse },
      },
    },
    async (request) => {
      const lido = await lerMultipart(request);
      const arquivo = exigirArquivo(lido);
      const campos = previewImportacaoCampos.safeParse({
        mapeamento: lido.campos.mapeamento ?? '',
      });
      if (!campos.success) {
        throw new ValidationError(
          'Mapeamento inválido',
          campos.error.issues.map((i) => ({
            // i.path já inclui "mapeamento" (é o campo do objeto validado) — não duplicar aqui.
            campo: i.path.map(String).join('.') || 'mapeamento',
            mensagem: i.message,
          })),
        );
      }
      const data = await service.preview(
        ctxDe(app, request),
        arquivo.nome || 'arquivo.csv',
        arquivo.conteudo,
        campos.data.mapeamento,
      );
      return { data };
    },
  );

  app.post(
    '/csv/confirmar',
    {
      schema: {
        tags: TAGS,
        summary: 'Cria os lançamentos das linhas confirmadas (pula duplicadas)',
        body: confirmarImportacaoBody,
        response: {
          201: importacaoResponse,
          400: errorResponse,
          404: errorResponse,
          409: errorResponse,
          422: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const data = await service.confirmar(ctxDe(app, request), request.body);
      return reply.status(201).send({ data });
    },
  );

  app.get(
    '',
    {
      schema: {
        tags: TAGS,
        summary: 'Histórico de importações',
        querystring: listarImportacoesQuery,
        response: { 200: listaImportacoesResponse, 401: errorResponse },
      },
    },
    async (request) => service.listar(ctxDe(app, request), request.query),
  );

  app.get(
    '/:id',
    {
      schema: {
        tags: TAGS,
        summary: 'Detalhe de uma importação',
        params: idParam,
        response: { 200: importacaoResponse, 404: errorResponse },
      },
    },
    async (request) => ({ data: await service.obter(ctxDe(app, request), request.params.id) }),
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: TAGS,
        summary: 'Desfaz a importação: exclui (soft delete) os lançamentos criados por ela',
        params: idParam,
        response: { 200: desfazerImportacaoResponse, 404: errorResponse },
      },
    },
    async (request) => ({
      data: await service.desfazer(ctxDe(app, request), request.params.id),
    }),
  );
};
