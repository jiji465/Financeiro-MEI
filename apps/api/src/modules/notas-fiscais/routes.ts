// Rotas /api/v1/notas-fiscais (contexto autenticado). Schemas: @meifin/shared/schemas/notas.
import {
  arquivoNotaResponse,
  atualizarNotaFiscalBody,
  cancelarNotaFiscalBody,
  criarNotaFiscalBody,
  criarNotaFiscalResponse,
  errorResponse,
  idParam,
  itemResponse,
  listaNotasFiscaisResponse,
  listarNotasFiscaisQuery,
  notaFiscalDto,
  notaFiscalResponse,
  resumoNotasFiscaisQuery,
  resumoNotasFiscaisResponse,
  uuid,
  vincularNotaFiscalBody,
} from '@meifin/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { ValidationError } from '../../lib/errors.js';
import { forTenant } from '../../lib/tenant-db.js';
import * as service from './service.js';

const TAGS = ['notas-fiscais'];

/** POST /:id/cancelar devolve a nota e o que aconteceu com a receita vinculada. */
export const cancelarNotaFiscalResponse = itemResponse(
  z.object({
    nota: notaFiscalDto,
    lancamentoVinculado: z.object({ id: uuid, excluido: z.boolean() }).nullable(),
  }),
);

export const notasFiscaisRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '',
    {
      schema: {
        tags: TAGS,
        summary: 'Lista notas fiscais',
        querystring: listarNotasFiscaisQuery,
        response: { 200: listaNotasFiscaisResponse, 400: errorResponse, 401: errorResponse },
      },
    },
    async (request) => service.listar(forTenant(app.db, request.tenantId), request.query),
  );

  app.post(
    '',
    {
      schema: {
        tags: TAGS,
        summary: 'Registra nota (gerarReceita cria a receita; lancamentoId vincula uma existente)',
        body: criarNotaFiscalBody,
        response: {
          201: criarNotaFiscalResponse,
          400: errorResponse,
          404: errorResponse,
          409: errorResponse,
          422: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const data = await app.database.withTx((tx) =>
        service.criar(tx, request.tenantId, request.body),
      );
      return reply.status(201).send({ data });
    },
  );

  app.get(
    '/resumo',
    {
      schema: {
        tags: TAGS,
        summary: 'Resumo do ano: emitidas, canceladas, por tipo, por mês, sem lançamento',
        querystring: resumoNotasFiscaisQuery,
        response: { 200: resumoNotasFiscaisResponse, 400: errorResponse },
      },
    },
    async (request) => ({
      data: await service.resumo(
        forTenant(app.db, request.tenantId),
        request.query.ano ?? Number(app.hoje().slice(0, 4)),
      ),
    }),
  );

  app.get(
    '/:id',
    {
      schema: {
        tags: TAGS,
        summary: 'Detalhe da nota',
        params: idParam,
        response: { 200: notaFiscalResponse, 404: errorResponse },
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
        summary: 'Atualiza dados da nota (só emitidas)',
        params: idParam,
        body: atualizarNotaFiscalBody,
        response: {
          200: notaFiscalResponse,
          400: errorResponse,
          404: errorResponse,
          409: errorResponse,
          422: errorResponse,
        },
      },
    },
    async (request) => ({
      data: await app.database.withTx((tx) =>
        service.atualizar(tx, request.tenantId, request.params.id, request.body),
      ),
    }),
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: TAGS,
        summary: 'Exclui a nota (soft delete); a receita vinculada é mantida',
        params: idParam,
        response: { 204: z.null(), 404: errorResponse },
      },
    },
    async (request, reply) => {
      await service.excluir(forTenant(app.db, request.tenantId), request.params.id, app.storage);
      return reply.status(204).send(null);
    },
  );

  app.post(
    '/:id/cancelar',
    {
      schema: {
        tags: TAGS,
        summary: 'Cancela a nota (estornarReceita exclui a receita vinculada)',
        params: idParam,
        body: cancelarNotaFiscalBody,
        response: {
          200: cancelarNotaFiscalResponse,
          400: errorResponse,
          404: errorResponse,
          422: errorResponse,
        },
      },
    },
    async (request) => ({
      data: await app.database.withTx((tx) =>
        service.cancelar(tx, request.tenantId, request.params.id, request.body, app.hoje()),
      ),
    }),
  );

  app.post(
    '/:id/vincular',
    {
      schema: {
        tags: TAGS,
        summary: 'Vincula (ou desvincula com null) uma receita existente à nota',
        params: idParam,
        body: vincularNotaFiscalBody,
        response: {
          200: notaFiscalResponse,
          400: errorResponse,
          404: errorResponse,
          409: errorResponse,
          422: errorResponse,
        },
      },
    },
    async (request) => ({
      data: await app.database.withTx((tx) =>
        service.vincular(tx, request.tenantId, request.params.id, request.body.lancamentoId),
      ),
    }),
  );

  app.post(
    '/:id/arquivo',
    {
      schema: {
        tags: TAGS,
        summary: 'Envia o arquivo da nota (multipart, campo "arquivo": PDF/JPG/PNG/XML ≤ 10 MB)',
        params: idParam,
        consumes: ['multipart/form-data'],
        response: {
          200: arquivoNotaResponse,
          400: errorResponse,
          404: errorResponse,
          413: errorResponse,
        },
      },
    },
    async (request) => {
      const parte = await request.file();
      if (!parte) {
        throw new ValidationError('Envie o arquivo no campo "arquivo"', [
          { campo: 'arquivo', mensagem: 'Arquivo obrigatório' },
        ]);
      }
      const conteudo = await parte.toBuffer();
      const data = await service.salvarArquivo(
        forTenant(app.db, request.tenantId),
        request.params.id,
        app.storage,
        { nome: parte.filename, mime: parte.mimetype, conteudo },
      );
      return { data };
    },
  );

  app.get(
    '/:id/arquivo',
    {
      schema: {
        tags: TAGS,
        summary: 'Baixa o arquivo da nota',
        params: idParam,
        // Sem schema de resposta: o corpo é o arquivo bruto (content-type do próprio arquivo).
      },
    },
    async (request, reply) => {
      const arquivo = await service.lerArquivo(
        forTenant(app.db, request.tenantId),
        request.params.id,
        app.storage,
      );
      const nome = encodeURIComponent(arquivo.nome);
      return reply
        .header('content-type', arquivo.mime)
        .header('content-length', arquivo.conteudo.length)
        .header('content-disposition', `attachment; filename*=UTF-8''${nome}`)
        .send(arquivo.conteudo);
    },
  );

  app.delete(
    '/:id/arquivo',
    {
      schema: {
        tags: TAGS,
        summary: 'Remove o arquivo da nota',
        params: idParam,
        response: { 204: z.null(), 404: errorResponse },
      },
    },
    async (request, reply) => {
      await service.removerArquivo(
        forTenant(app.db, request.tenantId),
        request.params.id,
        app.storage,
      );
      return reply.status(204).send(null);
    },
  );
};
