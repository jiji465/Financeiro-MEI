// Rotas /api/v1/titulos e /api/v1/parcelas (módulo registrado com prefixo '' — caminhos completos).
// Schemas: @meifin/shared/schemas/titulos. Fluxos com escrita em mais de uma tabela usam withTx.
import {
  atualizarParcelaBody,
  atualizarTituloBody,
  baixaParcelaBody,
  baixaParcelaResponse,
  criarTituloBody,
  errorResponse,
  idParam,
  listaParcelasResponse,
  listarParcelasQuery,
  listarTitulosQuery,
  listaTitulosResponse,
  parcelaResponse,
  resumoParcelasQuery,
  resumoParcelasResponse,
  tituloResponse,
} from '@meifin/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { forTenant } from '../../lib/tenant-db.js';
import * as service from './service.js';

const TAGS_TITULOS = ['titulos'];
const TAGS_PARCELAS = ['parcelas'];

export const titulosRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/titulos',
    {
      schema: {
        tags: TAGS_TITULOS,
        summary: 'Lista contas a pagar/receber (com parcelas)',
        querystring: listarTitulosQuery,
        response: { 200: listaTitulosResponse, 400: errorResponse, 401: errorResponse },
      },
    },
    async (request) =>
      service.listarTitulos(forTenant(app.db, request.tenantId), request.query, app.hoje()),
  );

  app.post(
    '/titulos',
    {
      schema: {
        tags: TAGS_TITULOS,
        summary: 'Cria conta a pagar/receber com parcelas (quantidade ou lista manual)',
        body: criarTituloBody,
        response: {
          201: tituloResponse,
          400: errorResponse,
          404: errorResponse,
          422: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const data = await app.database.withTx((tx) =>
        service.criarTitulo(tx, request.tenantId, request.body, app.hoje()),
      );
      return reply.status(201).send({ data });
    },
  );

  app.get(
    '/titulos/:id',
    {
      schema: {
        tags: TAGS_TITULOS,
        summary: 'Detalhe da conta com todas as parcelas',
        params: idParam,
        response: { 200: tituloResponse, 404: errorResponse },
      },
    },
    async (request) => ({
      data: await service.obterTitulo(
        forTenant(app.db, request.tenantId),
        request.params.id,
        app.hoje(),
      ),
    }),
  );

  app.patch(
    '/titulos/:id',
    {
      schema: {
        tags: TAGS_TITULOS,
        summary: 'Atualiza metadados da conta (status: cancelado cancela as parcelas abertas)',
        params: idParam,
        body: atualizarTituloBody,
        response: {
          200: tituloResponse,
          400: errorResponse,
          404: errorResponse,
          422: errorResponse,
        },
      },
    },
    async (request) => ({
      data: await app.database.withTx((tx) =>
        service.atualizarTitulo(tx, request.tenantId, request.params.id, request.body, app.hoje()),
      ),
    }),
  );

  app.delete(
    '/titulos/:id',
    {
      schema: {
        tags: TAGS_TITULOS,
        summary: 'Cancela a conta (422 se houver parcela paga)',
        params: idParam,
        response: { 200: tituloResponse, 404: errorResponse, 422: errorResponse },
      },
    },
    async (request) => ({
      data: await app.database.withTx((tx) =>
        service.cancelarTitulo(tx, request.tenantId, request.params.id, app.hoje()),
      ),
    }),
  );
};

export const parcelasRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/parcelas',
    {
      schema: {
        tags: TAGS_PARCELAS,
        summary: 'Lista parcelas (com título e contato) ordenadas por vencimento',
        querystring: listarParcelasQuery,
        response: { 200: listaParcelasResponse, 400: errorResponse, 401: errorResponse },
      },
    },
    async (request) =>
      service.listarParcelas(forTenant(app.db, request.tenantId), request.query, app.hoje()),
  );

  app.get(
    '/parcelas/resumo',
    {
      schema: {
        tags: TAGS_PARCELAS,
        summary: 'Resumo: atrasadas, próximas (hoje + dias), abertas e pagas no período',
        querystring: resumoParcelasQuery,
        response: { 200: resumoParcelasResponse, 400: errorResponse },
      },
    },
    async (request) => ({
      data: await service.resumo(
        forTenant(app.db, request.tenantId),
        request.query.dias,
        app.hoje(),
      ),
    }),
  );

  app.get(
    '/parcelas/:id',
    {
      schema: {
        tags: TAGS_PARCELAS,
        summary: 'Detalhe da parcela (com título)',
        params: idParam,
        response: { 200: parcelaResponse, 404: errorResponse },
      },
    },
    async (request) => ({
      data: await service.obterParcela(
        forTenant(app.db, request.tenantId),
        request.params.id,
        app.hoje(),
      ),
    }),
  );

  app.patch(
    '/parcelas/:id',
    {
      schema: {
        tags: TAGS_PARCELAS,
        summary: 'Altera vencimento/valor de uma parcela em aberto',
        params: idParam,
        body: atualizarParcelaBody,
        response: {
          200: parcelaResponse,
          400: errorResponse,
          404: errorResponse,
          422: errorResponse,
        },
      },
    },
    async (request) => ({
      data: await app.database.withTx((tx) =>
        service.atualizarParcela(tx, request.tenantId, request.params.id, request.body, app.hoje()),
      ),
    }),
  );

  app.post(
    '/parcelas/:id/baixa',
    {
      schema: {
        tags: TAGS_PARCELAS,
        summary: 'Baixa a parcela: cria lançamento (origem baixa) e quita o título se for a última',
        params: idParam,
        body: baixaParcelaBody,
        response: {
          201: baixaParcelaResponse,
          400: errorResponse,
          404: errorResponse,
          422: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const data = await app.database.withTx((tx) =>
        service.baixarParcela(tx, request.tenantId, request.params.id, request.body, app.hoje()),
      );
      return reply.status(201).send({ data });
    },
  );

  app.delete(
    '/parcelas/:id/baixa',
    {
      schema: {
        tags: TAGS_PARCELAS,
        summary: 'Estorna a baixa: exclui o lançamento e reabre a parcela',
        params: idParam,
        response: { 200: parcelaResponse, 404: errorResponse, 422: errorResponse },
      },
    },
    async (request) => ({
      data: await app.database.withTx((tx) =>
        service.estornarParcela(tx, request.tenantId, request.params.id, app.hoje()),
      ),
    }),
  );
};
