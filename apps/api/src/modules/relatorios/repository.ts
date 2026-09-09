// Consultas (somente leitura) dos relatórios. Reaproveita as consultas do dashboard onde faz
// sentido (contexto do tenant, DAS pagos, receitas por mês) e acrescenta as específicas:
// linhas da DRE, extrato, exportação de lançamentos e parcelas (contas).
import type {
  FormaPagamento,
  GrupoDasn,
  LinhaDre,
  OrigemLancamento,
  RegimeApuracao,
  StatusLancamento,
  StatusParcela,
  TipoLancamento,
  TipoTitulo,
} from '@meifin/shared';
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lt,
  lte,
  ne,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';

import { categorias } from '../../db/schema/categorias.js';
import { contatos } from '../../db/schema/contatos.js';
import { lancamentos } from '../../db/schema/lancamentos.js';
import { dasnDeclaracoes, type DasnDeclaracaoRow } from '../../db/schema/obrigacoes.js';
import { parcelas, titulos } from '../../db/schema/titulos.js';
import type { TenantDb } from '../../lib/tenant-db.js';

export {
  acumuladoReceitasAno,
  contextoTenant,
  dasPagosDoAno,
  receitasPorMesEGrupo,
  temReceitaSemGrupo,
} from '../dashboard/repository.js';

function dataPorRegime(regime: RegimeApuracao): SQL {
  return regime === 'caixa'
    ? sql`coalesce(${lancamentos.dataPagamento}, ${lancamentos.data})`
    : sql`${lancamentos.data}`;
}

// ---------------------------------------------------------------------------
// DRE
// ---------------------------------------------------------------------------

export interface LinhaDreAgregada extends LinhaDre {
  quantidade: number;
}

/**
 * Linhas da DRE agregadas por categoria. Competência: por `data` (pagos e pendentes);
 * caixa: por coalesce(data_pagamento, data) e só pagos.
 */
export async function linhasDre(
  tdb: TenantDb,
  f: { de: string; ate: string; regime: RegimeApuracao },
): Promise<LinhaDreAgregada[]> {
  const dataEfetiva = dataPorRegime(f.regime);
  const condicoes = [
    tdb.scoped(lancamentos),
    sql`${dataEfetiva} >= ${f.de}`,
    sql`${dataEfetiva} <= ${f.ate}`,
  ];
  if (f.regime === 'caixa') condicoes.push(eq(lancamentos.status, 'pago'));
  const linhas = await tdb.exec
    .select({
      tipo: lancamentos.tipo,
      categoriaId: categorias.id,
      categoriaNome: categorias.nome,
      grupoDasn: categorias.grupoDasn,
      categoriaSistema: categorias.sistema,
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
    .groupBy(
      lancamentos.tipo,
      categorias.id,
      categorias.nome,
      categorias.grupoDasn,
      categorias.sistema,
    )
    .orderBy(desc(sql`sum(${lancamentos.valor})`));
  return linhas.map((l) => ({ ...l, grupoDasn: l.grupoDasn as GrupoDasn | null }));
}

// ---------------------------------------------------------------------------
// Extrato e exportação de lançamentos
// ---------------------------------------------------------------------------

export interface FiltroLancamentos {
  de?: string;
  ate?: string;
  tipo?: TipoLancamento;
  status?: StatusLancamento;
  categoriaId?: string;
  contatoId?: string;
  formaPagamento?: FormaPagamento;
  origem?: OrigemLancamento;
  busca?: string;
  ordenarPor?: 'data' | 'valor' | 'descricao' | 'createdAt';
  ordem?: 'asc' | 'desc';
}

export interface LancamentoCompleto {
  id: string;
  data: string;
  descricao: string;
  tipo: TipoLancamento;
  categoria: string | null;
  contato: string | null;
  formaPagamento: FormaPagamento | null;
  status: StatusLancamento;
  dataPagamento: string | null;
  origem: OrigemLancamento;
  observacoes: string | null;
  valor: number;
}

function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function condicoesLancamentos(tdb: TenantDb, f: FiltroLancamentos): SQL[] {
  const c: SQL[] = [tdb.scoped(lancamentos)];
  if (f.de) c.push(gte(lancamentos.data, f.de));
  if (f.ate) c.push(lte(lancamentos.data, f.ate));
  if (f.tipo) c.push(eq(lancamentos.tipo, f.tipo));
  if (f.status) c.push(eq(lancamentos.status, f.status));
  if (f.categoriaId) c.push(eq(lancamentos.categoriaId, f.categoriaId));
  if (f.contatoId) c.push(eq(lancamentos.contatoId, f.contatoId));
  if (f.formaPagamento) c.push(eq(lancamentos.formaPagamento, f.formaPagamento));
  if (f.origem) c.push(eq(lancamentos.origem, f.origem));
  if (f.busca) {
    const padrao = `%${escaparLike(f.busca)}%`;
    c.push(
      or(
        ilike(lancamentos.descricao, padrao),
        ilike(lancamentos.observacoes, padrao),
        ilike(contatos.nome, padrao),
      ) as SQL,
    );
  }
  return c;
}

/** Lançamentos com nome da categoria e do contato, sem paginação (relatórios). */
export async function listarLancamentos(
  tdb: TenantDb,
  f: FiltroLancamentos,
): Promise<LancamentoCompleto[]> {
  const coluna = {
    data: lancamentos.data,
    valor: lancamentos.valor,
    descricao: lancamentos.descricao,
    createdAt: lancamentos.createdAt,
  }[f.ordenarPor ?? 'data'];
  const direcao = f.ordem === 'desc' ? desc : asc;
  return tdb.exec
    .select({
      id: lancamentos.id,
      data: lancamentos.data,
      descricao: lancamentos.descricao,
      tipo: lancamentos.tipo,
      categoria: categorias.nome,
      contato: contatos.nome,
      formaPagamento: lancamentos.formaPagamento,
      status: lancamentos.status,
      dataPagamento: lancamentos.dataPagamento,
      origem: lancamentos.origem,
      observacoes: lancamentos.observacoes,
      valor: lancamentos.valor,
    })
    .from(lancamentos)
    .leftJoin(
      categorias,
      and(
        eq(categorias.id, lancamentos.categoriaId),
        eq(categorias.tenantId, lancamentos.tenantId),
      ),
    )
    .leftJoin(
      contatos,
      and(eq(contatos.id, lancamentos.contatoId), eq(contatos.tenantId, lancamentos.tenantId)),
    )
    .where(and(...condicoesLancamentos(tdb, f)))
    .orderBy(direcao(coluna), direcao(lancamentos.createdAt), asc(lancamentos.id));
}

/** Saldo (pagos) antes de `de` respeitando os filtros de tipo/categoria/contato do extrato. */
export async function saldoAnteriorExtrato(
  tdb: TenantDb,
  de: string,
  f: Pick<FiltroLancamentos, 'tipo' | 'categoriaId' | 'contatoId'>,
): Promise<number> {
  const condicoes = [
    tdb.scoped(lancamentos),
    eq(lancamentos.status, 'pago'),
    lt(lancamentos.data, de),
  ];
  if (f.tipo) condicoes.push(eq(lancamentos.tipo, f.tipo));
  if (f.categoriaId) condicoes.push(eq(lancamentos.categoriaId, f.categoriaId));
  if (f.contatoId) condicoes.push(eq(lancamentos.contatoId, f.contatoId));
  const linhas = await tdb.exec
    .select({ tipo: lancamentos.tipo, total: tdb.sumInt(lancamentos.valor) })
    .from(lancamentos)
    .where(and(...condicoes))
    .groupBy(lancamentos.tipo);
  let saldo = 0;
  for (const l of linhas) saldo += l.tipo === 'receita' ? l.total : -l.total;
  return saldo;
}

// ---------------------------------------------------------------------------
// DASN
// ---------------------------------------------------------------------------

export async function declaracaoDasn(
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

// ---------------------------------------------------------------------------
// Contas (parcelas)
// ---------------------------------------------------------------------------

export interface FiltroContas {
  tipo?: TipoTitulo;
  status?: StatusParcela;
  contatoId?: string;
  vencimentoDe?: string;
  vencimentoAte?: string;
  /** true = só abertas com vencimento < hoje. */
  atrasadas?: boolean;
  hoje: string;
}

export interface ParcelaCompleta {
  parcelaId: string;
  tituloId: string;
  tipo: TipoTitulo;
  descricao: string;
  contato: string | null;
  categoria: string | null;
  numero: number;
  numeroParcelas: number;
  vencimento: string;
  valor: number;
  status: StatusParcela;
  dataPagamento: string | null;
  valorPago: number | null;
}

export async function listarParcelas(tdb: TenantDb, f: FiltroContas): Promise<ParcelaCompleta[]> {
  const condicoes: SQL[] = [
    tdb.scoped(parcelas),
    isNull(titulos.deletedAt),
    ne(titulos.status, 'cancelado'),
  ];
  if (f.tipo) condicoes.push(eq(titulos.tipo, f.tipo));
  if (f.status) condicoes.push(eq(parcelas.status, f.status));
  if (f.contatoId) condicoes.push(eq(titulos.contatoId, f.contatoId));
  if (f.vencimentoDe) condicoes.push(gte(parcelas.vencimento, f.vencimentoDe));
  if (f.vencimentoAte) condicoes.push(lte(parcelas.vencimento, f.vencimentoAte));
  if (f.atrasadas) {
    condicoes.push(eq(parcelas.status, 'aberta'), lt(parcelas.vencimento, f.hoje));
  }
  return tdb.exec
    .select({
      parcelaId: parcelas.id,
      tituloId: titulos.id,
      tipo: titulos.tipo,
      descricao: titulos.descricao,
      contato: contatos.nome,
      categoria: categorias.nome,
      numero: parcelas.numero,
      numeroParcelas: titulos.numeroParcelas,
      vencimento: parcelas.vencimento,
      valor: parcelas.valor,
      status: parcelas.status,
      dataPagamento: parcelas.dataPagamento,
      valorPago: parcelas.valorPago,
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
    .leftJoin(
      categorias,
      and(eq(categorias.id, titulos.categoriaId), eq(categorias.tenantId, titulos.tenantId)),
    )
    .where(and(...condicoes))
    .orderBy(asc(parcelas.vencimento), asc(titulos.descricao), asc(parcelas.numero));
}
