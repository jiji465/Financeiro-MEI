// Acesso a dados das obrigações do MEI. Único lugar do módulo que chama select/insert/update/delete.
// Lê parâmetros globais, das_pagamentos, dasn_declaracoes, alertas_dispensados e faz leituras
// (somente leitura) em lançamentos/categorias/parcelas/títulos para apurar faturamento, calendário e alertas.
import type { GrupoDasn, IsoDate } from '@meifin/shared';
import { and, asc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';

import type { DbExecutor } from '../../db/index.js';
import { categorias } from '../../db/schema/categorias.js';
import { lancamentos } from '../../db/schema/lancamentos.js';
import {
  alertasDispensados,
  type DasnDeclaracaoInsert,
  type DasnDeclaracaoRow,
  dasnDeclaracoes,
  type DasPagamentoInsert,
  type DasPagamentoRow,
  dasPagamentos,
} from '../../db/schema/obrigacoes.js';
import { parametrosMei, type ParametrosMeiRow } from '../../db/schema/parametros.js';
import { parcelas, titulos } from '../../db/schema/titulos.js';
import type { TenantDb } from '../../lib/tenant-db.js';

// ---------------------------------------------------------------------------
// Parâmetros globais
// ---------------------------------------------------------------------------

export function listarParametros(exec: DbExecutor): Promise<ParametrosMeiRow[]> {
  return exec.select().from(parametrosMei).orderBy(asc(parametrosMei.ano));
}

// ---------------------------------------------------------------------------
// DAS pagos
// ---------------------------------------------------------------------------

export async function listarPagamentosDoAno(
  tdb: TenantDb,
  ano: number,
): Promise<DasPagamentoRow[]> {
  return tdb.exec
    .select()
    .from(dasPagamentos)
    .where(
      and(
        tdb.scoped(dasPagamentos),
        gte(dasPagamentos.competencia, `${ano}-01-01`),
        lte(dasPagamentos.competencia, `${ano}-12-31`),
      ),
    )
    .orderBy(asc(dasPagamentos.competencia));
}

/** `competencia` no formato AAAA-MM (a coluna guarda AAAA-MM-01). */
export async function buscarPagamento(
  tdb: TenantDb,
  competencia: string,
): Promise<DasPagamentoRow | null> {
  const linhas = await tdb.exec
    .select()
    .from(dasPagamentos)
    .where(and(tdb.scoped(dasPagamentos), eq(dasPagamentos.competencia, `${competencia}-01`)))
    .limit(1);
  return linhas[0] ?? null;
}

export function inserirPagamento(
  tdb: TenantDb,
  valores: Omit<DasPagamentoInsert, 'tenantId' | 'id'>,
): Promise<DasPagamentoRow> {
  return tdb.insert(dasPagamentos, valores);
}

export function removerPagamento(tdb: TenantDb, id: string): Promise<void> {
  return tdb.hardDelete(dasPagamentos, id);
}

// ---------------------------------------------------------------------------
// DASN
// ---------------------------------------------------------------------------

export async function buscarDeclaracao(
  tdb: TenantDb,
  anoBase: number,
): Promise<DasnDeclaracaoRow | null> {
  const linhas = await tdb.exec
    .select()
    .from(dasnDeclaracoes)
    .where(and(tdb.scoped(dasnDeclaracoes), eq(dasnDeclaracoes.anoBase, anoBase)))
    .limit(1);
  return linhas[0] ?? null;
}

export async function listarDeclaracoes(
  tdb: TenantDb,
  anosBase: readonly number[],
): Promise<DasnDeclaracaoRow[]> {
  if (anosBase.length === 0) return [];
  return tdb.exec
    .select()
    .from(dasnDeclaracoes)
    .where(
      and(
        tdb.scoped(dasnDeclaracoes),
        or(...anosBase.map((ano) => eq(dasnDeclaracoes.anoBase, ano))),
      ),
    );
}

export async function salvarDeclaracao(
  tdb: TenantDb,
  anoBase: number,
  valores: Omit<DasnDeclaracaoInsert, 'tenantId' | 'id' | 'anoBase'>,
): Promise<DasnDeclaracaoRow> {
  const existente = await buscarDeclaracao(tdb, anoBase);
  if (existente) return tdb.update(dasnDeclaracoes, existente.id, valores);
  return tdb.insert(dasnDeclaracoes, { anoBase, ...valores });
}

// ---------------------------------------------------------------------------
// Alertas dispensados
// ---------------------------------------------------------------------------

/** Chaves dispensadas ainda vigentes (sem prazo ou com prazo ≥ hoje). */
export async function listarDispensados(tdb: TenantDb, hoje: IsoDate): Promise<string[]> {
  const linhas = await tdb.exec
    .select({ chave: alertasDispensados.chave })
    .from(alertasDispensados)
    .where(
      and(
        eq(alertasDispensados.tenantId, tdb.tenantId),
        or(isNull(alertasDispensados.dispensadoAte), gte(alertasDispensados.dispensadoAte, hoje)),
      ),
    );
  return linhas.map((l) => l.chave);
}

export async function dispensar(
  tdb: TenantDb,
  chave: string,
  dispensadoAte: IsoDate,
): Promise<void> {
  await tdb.exec
    .insert(alertasDispensados)
    .values({ tenantId: tdb.tenantId, chave, dispensadoAte })
    .onConflictDoUpdate({
      target: [alertasDispensados.tenantId, alertasDispensados.chave],
      set: { dispensadoAte, createdAt: sql`now()` },
    });
}

/** Devolve false quando não havia dispensa para a chave. */
export async function reativar(tdb: TenantDb, chave: string): Promise<boolean> {
  const linhas = await tdb.exec
    .delete(alertasDispensados)
    .where(and(eq(alertasDispensados.tenantId, tdb.tenantId), eq(alertasDispensados.chave, chave)))
    .returning({ chave: alertasDispensados.chave });
  return linhas.length > 0;
}

// ---------------------------------------------------------------------------
// Leituras em outros módulos (somente leitura)
// ---------------------------------------------------------------------------

export interface ReceitaRow {
  data: IsoDate;
  dataPagamento: IsoDate | null;
  status: 'pago' | 'pendente';
  valor: number;
  grupoDasn: GrupoDasn | null;
}

/**
 * Receitas (não excluídas) que podem entrar no ano, em qualquer regime: data no ano OU
 * data de pagamento no ano. O service aplica o regime (competência × caixa).
 */
export async function listarReceitasDoAno(tdb: TenantDb, ano: number): Promise<ReceitaRow[]> {
  const de = `${ano}-01-01`;
  const ate = `${ano}-12-31`;
  return tdb.exec
    .select({
      data: lancamentos.data,
      dataPagamento: lancamentos.dataPagamento,
      status: lancamentos.status,
      valor: lancamentos.valor,
      grupoDasn: categorias.grupoDasn,
    })
    .from(lancamentos)
    .innerJoin(
      categorias,
      and(
        eq(categorias.tenantId, lancamentos.tenantId),
        eq(categorias.id, lancamentos.categoriaId),
      ),
    )
    .where(
      and(
        tdb.scoped(lancamentos),
        eq(lancamentos.tipo, 'receita'),
        or(
          and(gte(lancamentos.data, de), lte(lancamentos.data, ate)),
          and(gte(lancamentos.dataPagamento, de), lte(lancamentos.dataPagamento, ate)),
        ),
      ),
    );
}

/** Existe receita em categoria sem grupo DASN em algum dos anos informados? */
export async function existeReceitaSemGrupo(
  tdb: TenantDb,
  anos: readonly number[],
): Promise<boolean> {
  if (anos.length === 0) return false;
  const de = `${Math.min(...anos)}-01-01`;
  const ate = `${Math.max(...anos)}-12-31`;
  const [linha] = await tdb.exec
    .select({ n: tdb.countInt() })
    .from(lancamentos)
    .innerJoin(
      categorias,
      and(
        eq(categorias.tenantId, lancamentos.tenantId),
        eq(categorias.id, lancamentos.categoriaId),
      ),
    )
    .where(
      and(
        tdb.scoped(lancamentos),
        eq(lancamentos.tipo, 'receita'),
        isNull(categorias.grupoDasn),
        gte(lancamentos.data, de),
        lte(lancamentos.data, ate),
      ),
    );
  return (linha?.n ?? 0) > 0;
}

export interface ParcelaAbertaRow {
  id: string;
  vencimento: IsoDate;
  valor: number;
  numero: number;
  numeroParcelas: number;
  tipo: 'pagar' | 'receber';
  descricao: string;
}

/** Parcelas em aberto (título não excluído) com vencimento no período. */
export async function listarParcelasAbertas(
  tdb: TenantDb,
  de: IsoDate,
  ate: IsoDate,
): Promise<ParcelaAbertaRow[]> {
  return tdb.exec
    .select({
      id: parcelas.id,
      vencimento: parcelas.vencimento,
      valor: parcelas.valor,
      numero: parcelas.numero,
      numeroParcelas: titulos.numeroParcelas,
      tipo: titulos.tipo,
      descricao: titulos.descricao,
    })
    .from(parcelas)
    .innerJoin(
      titulos,
      and(eq(titulos.tenantId, parcelas.tenantId), eq(titulos.id, parcelas.tituloId)),
    )
    .where(
      and(
        eq(parcelas.tenantId, tdb.tenantId),
        eq(parcelas.status, 'aberta'),
        isNull(titulos.deletedAt),
        gte(parcelas.vencimento, de),
        lte(parcelas.vencimento, ate),
      ),
    )
    .orderBy(asc(parcelas.vencimento), asc(parcelas.numero));
}

export interface ResumoParcelasRow {
  tipo: 'pagar' | 'receber';
  atrasadasQuantidade: number;
  atrasadasValor: number;
  proximasQuantidade: number;
  proximasValor: number;
}

/** Contagem/soma de parcelas em aberto atrasadas (vencimento < hoje) e próximas (hoje..ate) por tipo. */
export async function resumirParcelasParaAlertas(
  tdb: TenantDb,
  hoje: IsoDate,
  ate: IsoDate,
): Promise<ResumoParcelasRow[]> {
  const atrasada = sql`${parcelas.vencimento} < ${hoje}`;
  const proxima = sql`${parcelas.vencimento} >= ${hoje} and ${parcelas.vencimento} <= ${ate}`;
  return tdb.exec
    .select({
      tipo: titulos.tipo,
      atrasadasQuantidade: sql<number>`count(*) filter (where ${atrasada})::int`,
      atrasadasValor: sql<number>`coalesce(sum(${parcelas.valor}) filter (where ${atrasada}), 0)::int`,
      proximasQuantidade: sql<number>`count(*) filter (where ${proxima})::int`,
      proximasValor: sql<number>`coalesce(sum(${parcelas.valor}) filter (where ${proxima}), 0)::int`,
    })
    .from(parcelas)
    .innerJoin(
      titulos,
      and(eq(titulos.tenantId, parcelas.tenantId), eq(titulos.id, parcelas.tituloId)),
    )
    .where(
      and(
        eq(parcelas.tenantId, tdb.tenantId),
        eq(parcelas.status, 'aberta'),
        isNull(titulos.deletedAt),
        lte(parcelas.vencimento, ate),
      ),
    )
    .groupBy(titulos.tipo);
}
