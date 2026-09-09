// Rotas /api/v1/dashboard (contexto autenticado: request.tenantId disponível).
// de/ate são opcionais aqui (padrão: mês civil de app.hoje()); os DTOs vêm de @meifin/shared.
import {
  comparativoMensalQuery,
  comparativoMensalResponse,
  errorResponse,
  fluxoCaixaQuery,
  fluxoCaixaResponse,
  isoDate,
  porCategoriaQuery,
  porCategoriaResponse,
  porContatoQuery,
  porContatoResponse,
  refinarPeriodo,
  resumoDashboardResponse,
} from '@meifin/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { forTenant } from '../../lib/tenant-db.js';
import * as service from './service.js';

const TAGS = ['dashboard'];

const periodoOpcional = { de: isoDate.optional(), ate: isoDate.optional() };

export const resumoQuery = refinarPeriodo(z.object(periodoOpcional));
export const fluxoQuery = refinarPeriodo(
  z.object({
    ...periodoOpcional,
    agrupamento: fluxoCaixaQuery.shape.agrupamento,
    incluirPrevisao: fluxoCaixaQuery.shape.incluirPrevisao,
  }),
);
export const categoriaQuery = refinarPeriodo(
  z.object({
    ...periodoOpcional,
    tipo: porCategoriaQuery.shape.tipo,
    somentePagos: porCategoriaQuery.shape.somentePagos,
    limite: porCategoriaQuery.shape.limite,
  }),
);
export const contatoQuery = refinarPeriodo(
  z.object({
    ...periodoOpcional,
    tipo: porContatoQuery.shape.tipo,
    somentePagos: porContatoQuery.shape.somentePagos,
    limite: porContatoQuery.shape.limite,
  }),
);

export const dashboardRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/resumo',
    {
      schema: {
        tags: TAGS,
        summary: 'Resumo do período (padrão: mês atual) com comparação, limite e vencimentos',
        querystring: resumoQuery,
        response: { 200: resumoDashboardResponse, 400: errorResponse, 401: errorResponse },
      },
    },
    async (request) => ({
      data: await service.resumo(forTenant(app.db, request.tenantId), request.query, app.hoje()),
    }),
  );

  app.get(
    '/fluxo-caixa',
    {
      schema: {
        tags: TAGS,
        summary: 'Fluxo de caixa por dia/semana/mês: realizado, previsto e saldo acumulado',
        querystring: fluxoQuery,
        response: { 200: fluxoCaixaResponse, 400: errorResponse, 401: errorResponse },
      },
    },
    async (request) => ({
      data: await service.fluxoCaixa(
        forTenant(app.db, request.tenantId),
        request.query,
        app.hoje(),
      ),
    }),
  );

  app.get(
    '/por-categoria',
    {
      schema: {
        tags: TAGS,
        summary: 'Totais por categoria (top N + Outras)',
        querystring: categoriaQuery,
        response: { 200: porCategoriaResponse, 400: errorResponse, 401: errorResponse },
      },
    },
    async (request) => ({
      data: await service.porCategoria(
        forTenant(app.db, request.tenantId),
        request.query,
        app.hoje(),
      ),
    }),
  );

  app.get(
    '/por-contato',
    {
      schema: {
        tags: TAGS,
        summary: 'Totais por cliente/fornecedor (top N + Outras)',
        querystring: contatoQuery,
        response: { 200: porContatoResponse, 400: errorResponse, 401: errorResponse },
      },
    },
    async (request) => ({
      data: await service.porContato(
        forTenant(app.db, request.tenantId),
        request.query,
        app.hoje(),
      ),
    }),
  );

  app.get(
    '/comparativo-mensal',
    {
      schema: {
        tags: TAGS,
        summary: 'Receitas, despesas e saldo dos últimos N meses',
        querystring: comparativoMensalQuery,
        response: { 200: comparativoMensalResponse, 400: errorResponse, 401: errorResponse },
      },
    },
    async (request) => ({
      data: await service.comparativoMensal(
        forTenant(app.db, request.tenantId),
        request.query,
        app.hoje(),
      ),
    }),
  );
};
