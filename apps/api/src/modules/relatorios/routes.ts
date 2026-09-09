// Rotas /api/v1/relatorios (contexto autenticado). Todos os relatórios aceitam ?formato=json|csv|pdf
// (padrão json, exceto /lancamentos que é csv): json devolve { data }, csv/pdf devolvem o arquivo
// binário com Content-Disposition (nomeArquivo/contentDisposition de lib/csv.ts).
import {
  centavos,
  contasRelatorioQuery,
  contasRelatorioResponse,
  dasnRelatorioQuery,
  dasnRelatorioResponse,
  dreQuery,
  dreResponse,
  extratoQuery,
  extratoResponse,
  FORMAS_PAGAMENTO,
  isoDate,
  lancamentosRelatorioQuery,
  limiteRelatorioQuery,
  limiteRelatorioResponse,
  ORIGENS_LANCAMENTO,
  STATUS_LANCAMENTO,
  TIPOS_LANCAMENTO,
  uuid,
} from '@meifin/shared';
import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { contentDisposition } from '../../lib/csv.js';
import { forTenant } from '../../lib/tenant-db.js';
import * as exportar from './exportar.js';
import * as service from './service.js';

const TAGS = ['relatorios'];

/** DTO local: schemas/relatorios.ts (P1-A, congelado) ainda não tem o envelope da lista bruta. */
const linhaLancamentoRelatorioDto = z.object({
  id: uuid,
  data: isoDate,
  descricao: z.string(),
  tipo: z.enum(TIPOS_LANCAMENTO),
  categoria: z.string().nullable(),
  contato: z.string().nullable(),
  formaPagamento: z.enum(FORMAS_PAGAMENTO).nullable(),
  status: z.enum(STATUS_LANCAMENTO),
  dataPagamento: isoDate.nullable(),
  origem: z.enum(ORIGENS_LANCAMENTO),
  observacoes: z.string().nullable(),
  valor: centavos,
});
const lancamentosRelatorioResponse = z.object({ data: z.array(linhaLancamentoRelatorioDto) });

async function enviarArquivo(
  reply: FastifyReply,
  arquivo: exportar.ArquivoGerado,
): Promise<FastifyReply> {
  return reply
    .header('content-type', arquivo.contentType)
    .header('content-disposition', contentDisposition(arquivo.nome))
    .send(arquivo.buffer);
}

export const relatoriosRoutes: FastifyPluginAsyncZod = async (app) => {
  // ------------------------------------------------------------------------- DRE
  app.get(
    '/dre',
    {
      schema: {
        tags: TAGS,
        summary: 'DRE simplificada do período (json/csv/pdf)',
        querystring: dreQuery,
      },
    },
    async (request, reply) => {
      const tdb = forTenant(app.db, request.tenantId);
      const dto = await service.dre(tdb, request.query, app.hoje());
      if (request.query.formato === 'csv') return enviarArquivo(reply, exportar.dreCsv(dto));
      if (request.query.formato === 'pdf') {
        const cabecalho = await service.cabecalho(tdb);
        return enviarArquivo(reply, await exportar.drePdf(dto, cabecalho.emissor));
      }
      return reply.send(dreResponse.parse({ data: dto }));
    },
  );

  // ---------------------------------------------------------------------- Extrato
  app.get(
    '/extrato',
    {
      schema: {
        tags: TAGS,
        summary: 'Extrato de lançamentos com saldo corrido (json/csv/pdf)',
        querystring: extratoQuery,
      },
    },
    async (request, reply) => {
      const tdb = forTenant(app.db, request.tenantId);
      const dto = await service.extrato(tdb, request.query, app.hoje());
      if (request.query.formato === 'csv') return enviarArquivo(reply, exportar.extratoCsv(dto));
      if (request.query.formato === 'pdf') {
        const cabecalho = await service.cabecalho(tdb);
        return enviarArquivo(reply, await exportar.extratoPdf(dto, cabecalho.emissor));
      }
      return reply.send(extratoResponse.parse({ data: dto }));
    },
  );

  // ------------------------------------------------------------------------- DASN
  app.get(
    '/dasn',
    {
      schema: {
        tags: TAGS,
        summary: 'Relatório para a DASN-SIMEI do ano-base (json/csv/pdf)',
        querystring: dasnRelatorioQuery,
      },
    },
    async (request, reply) => {
      const tdb = forTenant(app.db, request.tenantId);
      const dto = await service.dasn(tdb, request.query, app.hoje());
      if (request.query.formato === 'csv') return enviarArquivo(reply, exportar.dasnCsv(dto));
      if (request.query.formato === 'pdf') {
        const cabecalho = await service.cabecalho(tdb);
        return enviarArquivo(reply, await exportar.dasnPdf(dto, cabecalho.emissor));
      }
      return reply.send(dasnRelatorioResponse.parse({ data: dto }));
    },
  );

  // ----------------------------------------------------------------------- Limite
  app.get(
    '/limite',
    {
      schema: {
        tags: TAGS,
        summary: 'Limite anual de faturamento x acumulado, mês a mês (json/csv/pdf)',
        querystring: limiteRelatorioQuery,
      },
    },
    async (request, reply) => {
      const tdb = forTenant(app.db, request.tenantId);
      const dto = await service.limite(tdb, request.query, app.hoje());
      if (request.query.formato === 'csv') return enviarArquivo(reply, exportar.limiteCsv(dto));
      if (request.query.formato === 'pdf') {
        const cabecalho = await service.cabecalho(tdb);
        return enviarArquivo(reply, await exportar.limitePdf(dto, cabecalho.emissor));
      }
      return reply.send(limiteRelatorioResponse.parse({ data: dto }));
    },
  );

  // ----------------------------------------------------------------- Lançamentos
  app.get(
    '/lancamentos',
    {
      schema: {
        tags: TAGS,
        summary: 'Exportação bruta de lançamentos filtrados, sem paginação (csv por padrão)',
        querystring: lancamentosRelatorioQuery,
      },
    },
    async (request, reply) => {
      const tdb = forTenant(app.db, request.tenantId);
      const { formato, ...query } = request.query;
      const linhas = await service.lancamentos(tdb, query);
      if (formato === 'csv') {
        return enviarArquivo(reply, exportar.lancamentosCsv(linhas, query));
      }
      if (formato === 'pdf') {
        const cabecalho = await service.cabecalho(tdb);
        return enviarArquivo(
          reply,
          await exportar.lancamentosPdf(linhas, query, cabecalho.emissor),
        );
      }
      return reply.send(lancamentosRelatorioResponse.parse({ data: linhas }));
    },
  );

  // ----------------------------------------------------------------------- Contas
  app.get(
    '/contas',
    {
      schema: {
        tags: TAGS,
        summary: 'Contas a pagar e a receber (parcelas) com totais (json/csv/pdf)',
        querystring: contasRelatorioQuery,
      },
    },
    async (request, reply) => {
      const tdb = forTenant(app.db, request.tenantId);
      const dto = await service.contas(tdb, request.query, app.hoje());
      if (request.query.formato === 'csv') return enviarArquivo(reply, exportar.contasCsv(dto));
      if (request.query.formato === 'pdf') {
        const cabecalho = await service.cabecalho(tdb);
        return enviarArquivo(reply, await exportar.contasPdf(dto, cabecalho.emissor));
      }
      return reply.send(contasRelatorioResponse.parse({ data: dto }));
    },
  );
};
