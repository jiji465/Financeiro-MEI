// Rotas /api/v1/obrigacoes (contexto autenticado). Schemas: @meifin/shared/schemas/obrigacoes.
// Os alertas ficam em /obrigacoes/alertas (o registry monta o módulo sob o prefixo /obrigacoes).
import {
  alertasResponse,
  anoBaseParam,
  calendarioQuery,
  calendarioResponse,
  chaveAlertaParam,
  competenciaParam,
  dasAnoQuery,
  dasAnoResponse,
  dasCompetenciaDto,
  dasnQuery,
  dasnResponse,
  dispensarAlertaBody,
  dispensarAlertaResponse,
  errorResponse,
  itemResponse,
  limiteQuery,
  limiteResponse,
  pagamentoDasResponse,
  parametrosQuery,
  parametrosResponse,
  reativarAlertaResponse,
  registrarPagamentoDasBody,
  salvarDasnBody,
} from '@meifin/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import * as service from './service.js';

const TAGS = ['obrigacoes'];

/** Contrato do shared + `origem` ('exato' | 'fallback'), redundante com `desatualizado`. */
const parametrosComOrigemResponse = z.object({
  data: parametrosResponse.shape.data.extend({ origem: z.enum(['exato', 'fallback']) }),
});

const competenciaResponse = itemResponse(dasCompetenciaDto);

export const obrigacoesRoutes: FastifyPluginAsyncZod = async (app) => {
  // ---------------------------------------------------------------- parâmetros
  app.get(
    '/parametros',
    {
      schema: {
        tags: TAGS,
        summary: 'Parâmetros do MEI do ano (ou do ano anterior mais próximo) e DAS calculado',
        querystring: parametrosQuery,
        response: { 200: parametrosComOrigemResponse, 401: errorResponse, 422: errorResponse },
      },
    },
    async (request) => ({
      data: await service.parametrosComDas(
        app.db,
        request.tenantId,
        request.query.ano ?? service.anoPadrao(app.hoje()),
      ),
    }),
  );

  // ----------------------------------------------------------------------- DAS
  app.get(
    '/das',
    {
      schema: {
        tags: TAGS,
        summary: 'DAS mensal do ano: 12 competências com valor, vencimento, status e pagamento',
        querystring: dasAnoQuery,
        response: { 200: dasAnoResponse, 401: errorResponse, 422: errorResponse },
      },
    },
    async (request) => ({
      data: await service.montarDasAno(
        app.db,
        request.tenantId,
        request.query.ano ?? service.anoPadrao(app.hoje()),
        app.hoje(),
      ),
    }),
  );

  app.get(
    '/das/:competencia',
    {
      schema: {
        tags: TAGS,
        summary: 'Detalhe de uma competência do DAS',
        params: competenciaParam,
        response: { 200: competenciaResponse, 404: errorResponse, 422: errorResponse },
      },
    },
    async (request) => ({
      data: await service.obterCompetencia(
        app.db,
        request.tenantId,
        request.params.competencia,
        app.hoje(),
      ),
    }),
  );

  app.post(
    '/das/:competencia/pagamento',
    {
      schema: {
        tags: TAGS,
        summary: 'Marca o DAS como pago e gera a despesa (origem das) na categoria de sistema',
        params: competenciaParam,
        body: registrarPagamentoDasBody,
        response: {
          201: pagamentoDasResponse,
          400: errorResponse,
          409: errorResponse,
          422: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const data = await app.database.withTx((tx) =>
        service.registrarPagamento(
          tx,
          request.tenantId,
          request.params.competencia,
          request.body,
          app.hoje(),
        ),
      );
      return reply.status(201).send({ data });
    },
  );

  app.delete(
    '/das/:competencia/pagamento',
    {
      schema: {
        tags: TAGS,
        summary: 'Desfaz o pagamento do DAS (exclui a despesa gerada)',
        params: competenciaParam,
        response: { 200: competenciaResponse, 404: errorResponse },
      },
    },
    async (request) => ({
      data: await app.database.withTx((tx) =>
        service.desfazerPagamento(tx, request.tenantId, request.params.competencia, app.hoje()),
      ),
    }),
  );

  // ---------------------------------------------------------------------- DASN
  app.get(
    '/dasn',
    {
      schema: {
        tags: TAGS,
        summary: 'Declaração anual (DASN-SIMEI) do ano-base: faturamento apurado, prazo e situação',
        querystring: dasnQuery,
        response: { 200: dasnResponse, 401: errorResponse, 422: errorResponse },
      },
    },
    async (request) => ({
      data: await service.obterDasn(
        app.db,
        request.tenantId,
        request.query.ano ?? service.anoBasePadrao(app.hoje()),
        app.hoje(),
      ),
    }),
  );

  app.put(
    '/dasn/:anoBase',
    {
      schema: {
        tags: TAGS,
        summary: 'Registra a entrega (ou reabre) a DASN do ano-base, com snapshot do faturamento',
        params: anoBaseParam,
        body: salvarDasnBody,
        response: { 200: dasnResponse, 400: errorResponse, 422: errorResponse },
      },
    },
    async (request) => ({
      data: await app.database.withTx((tx) =>
        service.salvarDasn(tx, request.tenantId, request.params.anoBase, request.body, app.hoje()),
      ),
    }),
  );

  // -------------------------------------------------------------------- limite
  app.get(
    '/limite',
    {
      schema: {
        tags: TAGS,
        summary: 'Situação do limite anual de faturamento (regime das configurações)',
        querystring: limiteQuery,
        response: { 200: limiteResponse, 401: errorResponse, 422: errorResponse },
      },
    },
    async (request) => ({
      data: await service.obterLimite(
        app.db,
        request.tenantId,
        request.query.ano ?? service.anoPadrao(app.hoje()),
        app.hoje(),
      ),
    }),
  );

  // ---------------------------------------------------------------- calendário
  app.get(
    '/calendario',
    {
      schema: {
        tags: TAGS,
        summary: 'Vencimentos de DAS, prazo da DASN e parcelas em aberto no período',
        querystring: calendarioQuery,
        response: { 200: calendarioResponse, 400: errorResponse, 401: errorResponse },
      },
    },
    async (request) => ({
      data: await service.obterCalendario(
        app.db,
        request.tenantId,
        request.query.de,
        request.query.ate,
        app.hoje(),
      ),
    }),
  );

  // ------------------------------------------------------------------- alertas
  app.get(
    '/alertas',
    {
      schema: {
        tags: TAGS,
        summary:
          'Alertas calculados agora (DAS, limite, DASN, contas, cadastro), sem os dispensados',
        response: { 200: alertasResponse, 401: errorResponse },
      },
    },
    async (request) => ({
      data: await service.listarAlertas(app.db, request.tenantId, app.hoje()),
    }),
  );

  app.post(
    '/alertas/:chave/dispensar',
    {
      schema: {
        tags: TAGS,
        summary: 'Oculta um alerta até a data informada (padrão: 30 dias)',
        params: chaveAlertaParam,
        body: dispensarAlertaBody,
        response: { 200: dispensarAlertaResponse, 400: errorResponse, 422: errorResponse },
      },
    },
    async (request) => ({
      data: await service.dispensarAlerta(
        app.db,
        request.tenantId,
        request.params.chave,
        request.body.ate,
        app.hoje(),
      ),
    }),
  );

  app.delete(
    '/alertas/:chave/dispensar',
    {
      schema: {
        tags: TAGS,
        summary: 'Volta a exibir um alerta dispensado',
        params: chaveAlertaParam,
        response: { 200: reativarAlertaResponse, 404: errorResponse },
      },
    },
    async (request) => {
      await service.reativarAlerta(app.db, request.tenantId, request.params.chave);
      return { data: { ok: true as const } };
    },
  );
};
