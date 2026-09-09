// Consultas (somente leitura) do dashboard. Lê lancamentos, parcelas/titulos, das_pagamentos,
// categorias, contatos, tenants/configuracoes e parametros_mei diretamente — nunca importa
// services de outros módulos. Todo agregado monetário é ::int em centavos (tdb.sumInt).
import type { ItemFluxo, ParametrosMei, RegimeApuracao, TipoLancamento } from '@meifin/shared';
import { and, asc, desc, eq, gt, gte, isNull, lt, lte, ne, sql } from 'drizzle-orm';

import type { DbExecutor } from '../../db/index.js';
import { categorias } from '../../db/schema/categorias.js';
import { contatos } from '../../db/schema/contatos.js';
import { lancamentos } from '../../db/schema/lancamentos.js';
import { dasPagamentos } from '../../db/schema/obrigacoes.js';
import { parametrosMei } from '../../db/schema/parametros.js';
import {
  type ConfiguracoesRow,
  configuracoes,
  type TenantRow,
  tenants,
} from '../../db/schema/tenants.js';
import { parcelas, titulos } from '../../db/schema/titulos.js';
import { NotFoundError } from '../../lib/errors.js';
import type { TenantDb } from '../../lib/tenant-db.js';

// ---------------------------------------------------------------------------
// Contexto do tenant (MEI + configurações + parâmetros legais)
// ---------------------------------------------------------------------------

export interface ContextoTenant {
  tenant: TenantRow;
  configuracoes: ConfiguracoesRow;
  /** Todas as linhas de parametros_mei (o domínio escolhe o ano com selecionarParametros). */
  parametros: ParametrosMei[];
}

export async function contextoTenant(exec: DbExecutor, tenantId: string): Promise<ContextoTenant> {
  const [linha] = await exec
    .select({ tenant: tenants, configuracoes })
    .from(tenants)
    .innerJoin(configuracoes, eq(configuracoes.tenantId, tenants.id))
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!linha) throw new NotFoundError('MEI não encontrado');
  const parametros = await exec.select().from(parametrosMei).orderBy(asc(parametrosMei.ano));
  return {
    tenant: linha.tenant,
    configuracoes: linha.configuracoes,
    parametros: parametros.map((p) => ({
      ano: p.ano,
      salarioMinimo: p.salarioMinimo,
      aliquotaInssBp: p.aliquotaInssBp,
      aliquotaInssCaminhoneiroBp: p.aliquotaInssCaminhoneiroBp,
      icms: p.icms,
      iss: p.iss,
      limiteAnual: p.limiteAnual,
      limiteMensalProporcional: p.limiteMensalProporcional,
      toleranciaExcessoBp: p.toleranciaExcessoBp,
      diaVencimentoDas: p.diaVencimentoDas,
      dasnPrazoDia: p.dasnPrazoDia,
      dasnPrazoMes: p.dasnPrazoMes,
      alertasLimitePct: p.alertasLimitePct,
    })),
  };
}

// ---------------------------------------------------------------------------
// Lançamentos
// ---------------------------------------------------------------------------

export interface TotaisPorTipo {
  receitas: number;
  despesas: number;
}

export interface FiltroTotais {
  de: string;
  ate: string;
  status?: 'pago' | 'pendente';
}

/** Soma de receitas e despesas (por `data`) no período, opcionalmente por status. */
export async function totaisPorTipo(tdb: TenantDb, f: FiltroTotais): Promise<TotaisPorTipo> {
  const condicoes = [
    tdb.scoped(lancamentos),
    gte(lancamentos.data, f.de),
    lte(lancamentos.data, f.ate),
  ];
  if (f.status) condicoes.push(eq(lancamentos.status, f.status));
  const linhas = await tdb.exec
    .select({ tipo: lancamentos.tipo, total: tdb.sumInt(lancamentos.valor) })
    .from(lancamentos)
    .where(and(...condicoes))
    .groupBy(lancamentos.tipo);
  const saida: TotaisPorTipo = { receitas: 0, despesas: 0 };
  for (const l of linhas) {
    if (l.tipo === 'receita') saida.receitas = l.total;
    else saida.despesas = l.total;
  }
  return saida;
}

/** Saldo realizado (pagos) antes de `de`: receitas − despesas. */
export async function saldoAntes(tdb: TenantDb, de: string): Promise<number> {
  const linhas = await tdb.exec
    .select({ tipo: lancamentos.tipo, total: tdb.sumInt(lancamentos.valor) })
    .from(lancamentos)
    .where(and(tdb.scoped(lancamentos), eq(lancamentos.status, 'pago'), lt(lancamentos.data, de)))
    .groupBy(lancamentos.tipo);
  let saldo = 0;
  for (const l of linhas) saldo += l.tipo === 'receita' ? l.total : -l.total;
  return saldo;
}

export async function contarLancamentos(tdb: TenantDb, de: string, ate: string): Promise<number> {
  const [linha] = await tdb.exec
    .select({ n: tdb.countInt() })
    .from(lancamentos)
    .where(and(tdb.scoped(lancamentos), gte(lancamentos.data, de), lte(lancamentos.data, ate)));
  return linha?.n ?? 0;
}

/**
 * Itens de fluxo a partir dos lançamentos: pagos dentro de [de, ate] (realizados) e pendentes
 * com data ≤ ate (previstos; os vencidos são deslocados para hoje pelo domínio).
 * Agregado por data/tipo/status para reduzir linhas.
 */
export async function itensFluxoLancamentos(
  tdb: TenantDb,
  de: string,
  ate: string,
): Promise<ItemFluxo[]> {
  const linhas = await tdb.exec
    .select({
      data: lancamentos.data,
      tipo: lancamentos.tipo,
      status: lancamentos.status,
      total: tdb.sumInt(lancamentos.valor),
    })
    .from(lancamentos)
    .where(
      and(
        tdb.scoped(lancamentos),
        lte(lancamentos.data, ate),
        sql`(${lancamentos.status} = 'pendente' or ${lancamentos.data} >= ${de})`,
      ),
    )
    .groupBy(lancamentos.data, lancamentos.tipo, lancamentos.status)
    .orderBy(asc(lancamentos.data));
  return linhas.map((l) => ({
    data: l.data,
    tipo: l.tipo,
    valor: l.total,
    realizado: l.status === 'pago',
  }));
}

/** Parcelas abertas (títulos não cancelados/excluídos) com vencimento ≤ ate, como previstos. */
export async function itensFluxoParcelas(tdb: TenantDb, ate: string): Promise<ItemFluxo[]> {
  const linhas = await tdb.exec
    .select({
      data: parcelas.vencimento,
      tipo: titulos.tipo,
      total: tdb.sumInt(parcelas.valor),
    })
    .from(parcelas)
    .innerJoin(
      titulos,
      and(eq(titulos.id, parcelas.tituloId), eq(titulos.tenantId, parcelas.tenantId)),
    )
    .where(
      and(
        tdb.scoped(parcelas),
        tdb.scoped(titulos),
        eq(parcelas.status, 'aberta'),
        ne(titulos.status, 'cancelado'),
        lte(parcelas.vencimento, ate),
      ),
    )
    .groupBy(parcelas.vencimento, titulos.tipo)
    .orderBy(asc(parcelas.vencimento));
  return linhas.map((l) => ({
    data: l.data,
    tipo: (l.tipo === 'receber' ? 'receita' : 'despesa') as TipoLancamento,
    valor: l.total,
    realizado: false,
  }));
}

/** Total de parcelas abertas por tipo de título com vencimento em [de, ate]. */
export async function parcelasAbertasPorTipo(
  tdb: TenantDb,
  de: string,
  ate: string,
): Promise<{ receber: number; pagar: number }> {
  const linhas = await tdb.exec
    .select({ tipo: titulos.tipo, total: tdb.sumInt(parcelas.valor) })
    .from(parcelas)
    .innerJoin(
      titulos,
      and(eq(titulos.id, parcelas.tituloId), eq(titulos.tenantId, parcelas.tenantId)),
    )
    .where(
      and(
        tdb.scoped(parcelas),
        tdb.scoped(titulos),
        eq(parcelas.status, 'aberta'),
        ne(titulos.status, 'cancelado'),
        gte(parcelas.vencimento, de),
        lte(parcelas.vencimento, ate),
      ),
    )
    .groupBy(titulos.tipo);
  const saida = { receber: 0, pagar: 0 };
  for (const l of linhas) saida[l.tipo] = l.total;
  return saida;
}

export interface FiltroAgrupamento {
  de: string;
  ate: string;
  tipo: TipoLancamento;
  somentePagos: boolean;
}

export interface LinhaPorCategoria {
  categoriaId: string;
  nome: string;
  cor: string | null;
  icone: string | null;
  valor: number;
  quantidade: number;
}

export async function somarPorCategoria(
  tdb: TenantDb,
  f: FiltroAgrupamento,
): Promise<LinhaPorCategoria[]> {
  const condicoes = [
    tdb.scoped(lancamentos),
    eq(lancamentos.tipo, f.tipo),
    gte(lancamentos.data, f.de),
    lte(lancamentos.data, f.ate),
  ];
  if (f.somentePagos) condicoes.push(eq(lancamentos.status, 'pago'));
  return tdb.exec
    .select({
      categoriaId: categorias.id,
      nome: categorias.nome,
      cor: categorias.cor,
      icone: categorias.icone,
      valor: tdb.sumInt(lancamentos.valor),
      quantidade: tdb.countInt(),
    })
    .from(lancamentos)
    .innerJoin(
      categorias,
      and(
        eq(categorias.id, lancamentos.categoriaId),
        eq(categorias.tenantId, lancamentos.tenantId),
      ),
    )
    .where(and(...condicoes))
    .groupBy(categorias.id, categorias.nome, categorias.cor, categorias.icone)
    .orderBy(desc(sql`sum(${lancamentos.valor})`), asc(categorias.nome));
}

export interface LinhaPorContato {
  contatoId: string | null;
  nome: string | null;
  valor: number;
  quantidade: number;
}

export async function somarPorContato(
  tdb: TenantDb,
  f: FiltroAgrupamento,
): Promise<LinhaPorContato[]> {
  const condicoes = [
    tdb.scoped(lancamentos),
    eq(lancamentos.tipo, f.tipo),
    gte(lancamentos.data, f.de),
    lte(lancamentos.data, f.ate),
  ];
  if (f.somentePagos) condicoes.push(eq(lancamentos.status, 'pago'));
  return tdb.exec
    .select({
      contatoId: lancamentos.contatoId,
      nome: contatos.nome,
      valor: tdb.sumInt(lancamentos.valor),
      quantidade: tdb.countInt(),
    })
    .from(lancamentos)
    .leftJoin(
      contatos,
      and(eq(contatos.id, lancamentos.contatoId), eq(contatos.tenantId, lancamentos.tenantId)),
    )
    .where(and(...condicoes))
    .groupBy(lancamentos.contatoId, contatos.nome)
    .orderBy(desc(sql`sum(${lancamentos.valor})`), asc(contatos.nome));
}

export interface LinhaPorMes {
  competencia: string;
  tipo: TipoLancamento;
  status: 'pago' | 'pendente';
  total: number;
}

/** Totais por competência (AAAA-MM), tipo e status no intervalo (por `data`). */
export async function somarPorMes(tdb: TenantDb, de: string, ate: string): Promise<LinhaPorMes[]> {
  const competencia = sql<string>`to_char(${lancamentos.data}, 'YYYY-MM')`;
  return tdb.exec
    .select({
      competencia,
      tipo: lancamentos.tipo,
      status: lancamentos.status,
      total: tdb.sumInt(lancamentos.valor),
    })
    .from(lancamentos)
    .where(and(tdb.scoped(lancamentos), gte(lancamentos.data, de), lte(lancamentos.data, ate)))
    .groupBy(competencia, lancamentos.tipo, lancamentos.status)
    .orderBy(asc(competencia));
}

/**
 * Receitas acumuladas no ano conforme o regime (seção 5 do plano): competência usa `data`
 * (pagas e pendentes); caixa usa coalesce(data_pagamento, data) e só status pago.
 */
export async function acumuladoReceitasAno(
  tdb: TenantDb,
  ano: number,
  regime: RegimeApuracao,
): Promise<number> {
  const de = `${ano}-01-01`;
  const ate = `${ano}-12-31`;
  const dataEfetiva =
    regime === 'caixa'
      ? sql`coalesce(${lancamentos.dataPagamento}, ${lancamentos.data})`
      : sql`${lancamentos.data}`;
  const condicoes = [
    tdb.scoped(lancamentos),
    eq(lancamentos.tipo, 'receita'),
    sql`${dataEfetiva} >= ${de}`,
    sql`${dataEfetiva} <= ${ate}`,
  ];
  if (regime === 'caixa') condicoes.push(eq(lancamentos.status, 'pago'));
  const [linha] = await tdb.exec
    .select({ total: tdb.sumInt(lancamentos.valor) })
    .from(lancamentos)
    .where(and(...condicoes));
  return linha?.total ?? 0;
}

export interface ReceitaMensalGrupo {
  competencia: string;
  grupoDasn: 'comercio' | 'servicos' | null;
  valor: number;
}

/** Receitas do ano por competência e grupo DASN da categoria (regime das configurações). */
export async function receitasPorMesEGrupo(
  tdb: TenantDb,
  ano: number,
  regime: RegimeApuracao,
): Promise<ReceitaMensalGrupo[]> {
  const de = `${ano}-01-01`;
  const ate = `${ano}-12-31`;
  const dataEfetiva =
    regime === 'caixa'
      ? sql`coalesce(${lancamentos.dataPagamento}, ${lancamentos.data})`
      : sql`${lancamentos.data}`;
  const competencia = sql<string>`to_char(${dataEfetiva}, 'YYYY-MM')`;
  const condicoes = [
    tdb.scoped(lancamentos),
    eq(lancamentos.tipo, 'receita'),
    sql`${dataEfetiva} >= ${de}`,
    sql`${dataEfetiva} <= ${ate}`,
  ];
  if (regime === 'caixa') condicoes.push(eq(lancamentos.status, 'pago'));
  return tdb.exec
    .select({
      competencia,
      grupoDasn: categorias.grupoDasn,
      valor: tdb.sumInt(lancamentos.valor),
    })
    .from(lancamentos)
    .innerJoin(
      categorias,
      and(
        eq(categorias.id, lancamentos.categoriaId),
        eq(categorias.tenantId, lancamentos.tenantId),
      ),
    )
    .where(and(...condicoes))
    .groupBy(competencia, categorias.grupoDasn)
    .orderBy(asc(competencia));
}

// ---------------------------------------------------------------------------
// DAS e parcelas próximas
// ---------------------------------------------------------------------------

export interface DasPagoResumo {
  /** AAAA-MM */
  competencia: string;
  valorPago: number;
  dataPagamento: string;
}

/** DAS pagos do ano (competência normalizada para AAAA-MM). */
export async function dasPagosDoAno(tdb: TenantDb, ano: number): Promise<DasPagoResumo[]> {
  const linhas = await tdb.exec
    .select({
      competencia: dasPagamentos.competencia,
      valorPago: dasPagamentos.valorPago,
      dataPagamento: dasPagamentos.dataPagamento,
    })
    .from(dasPagamentos)
    .where(
      and(
        tdb.scoped(dasPagamentos),
        gte(dasPagamentos.competencia, `${ano}-01-01`),
        lte(dasPagamentos.competencia, `${ano}-12-31`),
      ),
    )
    .orderBy(asc(dasPagamentos.competencia));
  return linhas.map((l) => ({
    competencia: l.competencia.slice(0, 7),
    valorPago: l.valorPago,
    dataPagamento: l.dataPagamento,
  }));
}

export interface ParcelaProxima {
  parcelaId: string;
  tituloId: string;
  tipo: 'pagar' | 'receber';
  descricao: string;
  contato: string | null;
  numero: number;
  numeroParcelas: number;
  vencimento: string;
  valor: number;
}

/** Parcelas abertas com vencimento até `ate` (inclui vencidas), ordenadas por vencimento. */
export async function parcelasProximas(
  tdb: TenantDb,
  ate: string,
  limite: number,
): Promise<ParcelaProxima[]> {
  return tdb.exec
    .select({
      parcelaId: parcelas.id,
      tituloId: titulos.id,
      tipo: titulos.tipo,
      descricao: titulos.descricao,
      contato: contatos.nome,
      numero: parcelas.numero,
      numeroParcelas: titulos.numeroParcelas,
      vencimento: parcelas.vencimento,
      valor: parcelas.valor,
    })
    .from(parcelas)
    .innerJoin(
      titulos,
      and(eq(titulos.id, parcelas.tituloId), eq(titulos.tenantId, parcelas.tenantId)),
    )
    .leftJoin(
      contatos,
      and(eq(contatos.id, titulos.contatoId), eq(contatos.tenantId, titulos.tenantId)),
    )
    .where(
      and(
        tdb.scoped(parcelas),
        isNull(titulos.deletedAt),
        eq(parcelas.status, 'aberta'),
        ne(titulos.status, 'cancelado'),
        lte(parcelas.vencimento, ate),
      ),
    )
    .orderBy(asc(parcelas.vencimento), asc(parcelas.numero))
    .limit(limite);
}

/** true se existe receita em categoria sem grupo DASN no ano (alerta da DASN). */
export async function temReceitaSemGrupo(tdb: TenantDb, ano: number): Promise<boolean> {
  const [linha] = await tdb.exec
    .select({ n: tdb.countInt() })
    .from(lancamentos)
    .innerJoin(
      categorias,
      and(
        eq(categorias.id, lancamentos.categoriaId),
        eq(categorias.tenantId, lancamentos.tenantId),
      ),
    )
    .where(
      and(
        tdb.scoped(lancamentos),
        eq(lancamentos.tipo, 'receita'),
        isNull(categorias.grupoDasn),
        gte(lancamentos.data, `${ano}-01-01`),
        lte(lancamentos.data, `${ano}-12-31`),
        gt(lancamentos.valor, 0),
      ),
    );
  return (linha?.n ?? 0) > 0;
}
