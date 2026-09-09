// Acesso a dados de títulos e parcelas. Único lugar do módulo que chama select/insert/update.
import type { IsoDate } from '@meifin/shared';
import { and, asc, desc, eq, gte, ilike, inArray, lt, lte, or, sql, type SQL } from 'drizzle-orm';

import { categorias, type CategoriaRow } from '../../db/schema/categorias.js';
import { contatos, type ContatoRow } from '../../db/schema/contatos.js';
import { lancamentos, type LancamentoRow } from '../../db/schema/lancamentos.js';
import { notasFiscais, type NotaFiscalRow } from '../../db/schema/notas-fiscais.js';
import { parcelas, type ParcelaRow, titulos, type TituloRow } from '../../db/schema/titulos.js';
import type { TenantDb } from '../../lib/tenant-db.js';

export type ContatoRef = Pick<ContatoRow, 'id' | 'nome' | 'tipo'>;
export type CategoriaRef = Pick<CategoriaRow, 'id' | 'nome' | 'cor' | 'icone'>;

export interface TituloComRefs {
  titulo: TituloRow;
  contato: ContatoRef | null;
  categoria: CategoriaRef | null;
}

export interface ParcelaComTitulo {
  parcela: ParcelaRow;
  titulo: TituloRow;
  contato: ContatoRef | null;
}

const contatoRefCols = { id: contatos.id, nome: contatos.nome, tipo: contatos.tipo };
const categoriaRefCols = {
  id: categorias.id,
  nome: categorias.nome,
  cor: categorias.cor,
  icone: categorias.icone,
};

function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// ---------------------------------------------------------------------------
// Títulos
// ---------------------------------------------------------------------------

export interface FiltroTitulos {
  tipo?: TituloRow['tipo'];
  status?: TituloRow['status'];
  contatoId?: string;
  categoriaId?: string;
  de?: IsoDate;
  ate?: IsoDate;
  busca?: string;
  ordenarPor: 'dataEmissao' | 'valorTotal' | 'descricao' | 'createdAt';
  ordem: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

function condicoesTitulos(tdb: TenantDb, f: FiltroTitulos): SQL[] {
  const c = [tdb.scoped(titulos)];
  if (f.tipo) c.push(eq(titulos.tipo, f.tipo));
  if (f.status) c.push(eq(titulos.status, f.status));
  if (f.contatoId) c.push(eq(titulos.contatoId, f.contatoId));
  if (f.categoriaId) c.push(eq(titulos.categoriaId, f.categoriaId));
  if (f.de) c.push(gte(titulos.dataEmissao, f.de));
  if (f.ate) c.push(lte(titulos.dataEmissao, f.ate));
  if (f.busca) c.push(ilike(titulos.descricao, `%${escaparLike(f.busca)}%`));
  return c;
}

const ORDEM_TITULOS = {
  dataEmissao: titulos.dataEmissao,
  valorTotal: titulos.valorTotal,
  descricao: titulos.descricao,
  createdAt: titulos.createdAt,
} as const;

export async function listarTitulos(
  tdb: TenantDb,
  f: FiltroTitulos,
): Promise<{ itens: TituloComRefs[]; total: number }> {
  const where = and(...condicoesTitulos(tdb, f));
  const direcao = f.ordem === 'asc' ? asc : desc;
  const linhas = await tdb.exec
    .select({ titulo: titulos, contato: contatoRefCols, categoria: categoriaRefCols })
    .from(titulos)
    .leftJoin(
      contatos,
      and(eq(contatos.tenantId, titulos.tenantId), eq(contatos.id, titulos.contatoId)),
    )
    .leftJoin(
      categorias,
      and(eq(categorias.tenantId, titulos.tenantId), eq(categorias.id, titulos.categoriaId)),
    )
    .where(where)
    .orderBy(direcao(ORDEM_TITULOS[f.ordenarPor]), desc(titulos.createdAt))
    .limit(f.pageSize)
    .offset((f.page - 1) * f.pageSize);
  const [contagem] = await tdb.exec.select({ n: tdb.countInt() }).from(titulos).where(where);
  return { itens: linhas, total: contagem?.n ?? 0 };
}

export async function buscarTitulo(tdb: TenantDb, id: string): Promise<TituloComRefs | null> {
  const linhas = await tdb.exec
    .select({ titulo: titulos, contato: contatoRefCols, categoria: categoriaRefCols })
    .from(titulos)
    .leftJoin(
      contatos,
      and(eq(contatos.tenantId, titulos.tenantId), eq(contatos.id, titulos.contatoId)),
    )
    .leftJoin(
      categorias,
      and(eq(categorias.tenantId, titulos.tenantId), eq(categorias.id, titulos.categoriaId)),
    )
    .where(and(tdb.scoped(titulos), eq(titulos.id, id)))
    .limit(1);
  return linhas[0] ?? null;
}

export function criarTitulo(
  tdb: TenantDb,
  valores: Omit<typeof titulos.$inferInsert, 'tenantId' | 'id'>,
): Promise<TituloRow> {
  return tdb.insert(titulos, valores);
}

export function atualizarTitulo(
  tdb: TenantDb,
  id: string,
  valores: Partial<Omit<typeof titulos.$inferInsert, 'tenantId' | 'id'>>,
): Promise<TituloRow> {
  return tdb.update(titulos, id, valores);
}

// ---------------------------------------------------------------------------
// Parcelas
// ---------------------------------------------------------------------------

export async function listarParcelasDoTitulo(
  tdb: TenantDb,
  tituloId: string,
): Promise<ParcelaRow[]> {
  return tdb.exec
    .select()
    .from(parcelas)
    .where(and(tdb.scoped(parcelas), eq(parcelas.tituloId, tituloId)))
    .orderBy(asc(parcelas.numero));
}

export async function listarParcelasDosTitulos(
  tdb: TenantDb,
  tituloIds: string[],
): Promise<Map<string, ParcelaRow[]>> {
  const mapa = new Map<string, ParcelaRow[]>();
  if (tituloIds.length === 0) return mapa;
  const linhas = await tdb.exec
    .select()
    .from(parcelas)
    .where(and(tdb.scoped(parcelas), inArray(parcelas.tituloId, tituloIds)))
    .orderBy(asc(parcelas.numero));
  for (const p of linhas) {
    const lista = mapa.get(p.tituloId) ?? [];
    lista.push(p);
    mapa.set(p.tituloId, lista);
  }
  return mapa;
}

export async function criarParcelas(
  tdb: TenantDb,
  valores: Omit<typeof parcelas.$inferInsert, 'tenantId' | 'id'>[],
): Promise<ParcelaRow[]> {
  if (valores.length === 0) return [];
  return tdb.exec
    .insert(parcelas)
    .values(valores.map((v) => ({ ...v, tenantId: tdb.tenantId })))
    .returning();
}

export function atualizarParcela(
  tdb: TenantDb,
  id: string,
  valores: Partial<Omit<typeof parcelas.$inferInsert, 'tenantId' | 'id'>>,
): Promise<ParcelaRow> {
  return tdb.update(parcelas, id, valores);
}

/** Cancela todas as parcelas abertas do título; devolve quantas mudaram. */
export async function cancelarParcelasAbertas(tdb: TenantDb, tituloId: string): Promise<number> {
  const linhas = await tdb.exec
    .update(parcelas)
    .set({ status: 'cancelada', updatedAt: sql`now()` })
    .where(
      and(tdb.scoped(parcelas), eq(parcelas.tituloId, tituloId), eq(parcelas.status, 'aberta')),
    )
    .returning({ id: parcelas.id });
  return linhas.length;
}

export interface FiltroParcelas {
  tipo?: TituloRow['tipo'];
  status?: ParcelaRow['status'];
  contatoId?: string;
  vencimentoDe?: IsoDate;
  vencimentoAte?: IsoDate;
  /** Só abertas com vencimento < hoje. */
  atrasadas?: boolean;
  busca?: string;
  ordenarPor: 'vencimento' | 'valor';
  ordem: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

function condicoesParcelas(tdb: TenantDb, f: FiltroParcelas, hoje: IsoDate): SQL[] {
  const c = [tdb.scoped(parcelas), tdb.scoped(titulos)];
  if (f.tipo) c.push(eq(titulos.tipo, f.tipo));
  if (f.status) c.push(eq(parcelas.status, f.status));
  if (f.contatoId) c.push(eq(titulos.contatoId, f.contatoId));
  if (f.vencimentoDe) c.push(gte(parcelas.vencimento, f.vencimentoDe));
  if (f.vencimentoAte) c.push(lte(parcelas.vencimento, f.vencimentoAte));
  if (f.atrasadas === true) c.push(eq(parcelas.status, 'aberta'), lt(parcelas.vencimento, hoje));
  if (f.atrasadas === false) {
    c.push(or(sql`${parcelas.status} <> 'aberta'`, gte(parcelas.vencimento, hoje)) as SQL);
  }
  if (f.busca) c.push(ilike(titulos.descricao, `%${escaparLike(f.busca)}%`));
  return c;
}

const juncaoTitulo = and(
  eq(titulos.tenantId, parcelas.tenantId),
  eq(titulos.id, parcelas.tituloId),
);
const juncaoContato = and(
  eq(contatos.tenantId, titulos.tenantId),
  eq(contatos.id, titulos.contatoId),
);

export async function listarParcelas(
  tdb: TenantDb,
  f: FiltroParcelas,
  hoje: IsoDate,
): Promise<{
  itens: ParcelaComTitulo[];
  total: number;
  totalValor: number;
  totalAtrasado: number;
}> {
  const where = and(...condicoesParcelas(tdb, f, hoje));
  const direcao = f.ordem === 'asc' ? asc : desc;
  const coluna = f.ordenarPor === 'valor' ? parcelas.valor : parcelas.vencimento;
  const itens = await tdb.exec
    .select({ parcela: parcelas, titulo: titulos, contato: contatoRefCols })
    .from(parcelas)
    .innerJoin(titulos, juncaoTitulo)
    .leftJoin(contatos, juncaoContato)
    .where(where)
    .orderBy(direcao(coluna), asc(parcelas.numero), asc(parcelas.createdAt))
    .limit(f.pageSize)
    .offset((f.page - 1) * f.pageSize);
  const [agregados] = await tdb.exec
    .select({
      n: tdb.countInt(),
      valor: tdb.sumInt(parcelas.valor),
      atrasado: sql<number>`coalesce(sum(case when ${parcelas.status} = 'aberta' and ${parcelas.vencimento} < ${hoje} then ${parcelas.valor} else 0 end), 0)::int`,
    })
    .from(parcelas)
    .innerJoin(titulos, juncaoTitulo)
    .where(where);
  return {
    itens,
    total: agregados?.n ?? 0,
    totalValor: agregados?.valor ?? 0,
    totalAtrasado: agregados?.atrasado ?? 0,
  };
}

export async function buscarParcela(tdb: TenantDb, id: string): Promise<ParcelaComTitulo | null> {
  const linhas = await tdb.exec
    .select({ parcela: parcelas, titulo: titulos, contato: contatoRefCols })
    .from(parcelas)
    .innerJoin(titulos, juncaoTitulo)
    .leftJoin(contatos, juncaoContato)
    .where(and(tdb.scoped(parcelas), tdb.scoped(titulos), eq(parcelas.id, id)))
    .limit(1);
  return linhas[0] ?? null;
}

export interface GrupoResumo {
  quantidade: number;
  valor: number;
}

export interface ResumoPorTipo {
  atrasadas: GrupoResumo;
  proximas: GrupoResumo;
  abertas: GrupoResumo;
  pagasNoPeriodo: GrupoResumo;
}

export async function resumoParcelas(
  tdb: TenantDb,
  tipo: TituloRow['tipo'],
  hoje: IsoDate,
  limite: IsoDate,
  inicioPeriodo: IsoDate,
): Promise<ResumoPorTipo> {
  const aberta = sql`${parcelas.status} = 'aberta'`;
  const atrasada = sql`${aberta} and ${parcelas.vencimento} < ${hoje}`;
  const proxima = sql`${aberta} and ${parcelas.vencimento} >= ${hoje} and ${parcelas.vencimento} <= ${limite}`;
  const paga = sql`${parcelas.status} = 'paga' and ${parcelas.dataPagamento} >= ${inicioPeriodo} and ${parcelas.dataPagamento} <= ${hoje}`;
  const qtd = (cond: SQL) => sql<number>`count(*) filter (where ${cond})::int`;
  const soma = (cond: SQL) =>
    sql<number>`coalesce(sum(case when ${cond} then ${parcelas.valor} else 0 end), 0)::int`;
  const somaPaga = sql<number>`coalesce(sum(case when ${paga} then coalesce(${parcelas.valorPago}, ${parcelas.valor}) else 0 end), 0)::int`;
  const [r] = await tdb.exec
    .select({
      atrasadasQtd: qtd(atrasada),
      atrasadasValor: soma(atrasada),
      proximasQtd: qtd(proxima),
      proximasValor: soma(proxima),
      abertasQtd: qtd(aberta),
      abertasValor: soma(aberta),
      pagasQtd: qtd(paga),
      pagasValor: somaPaga,
    })
    .from(parcelas)
    .innerJoin(titulos, juncaoTitulo)
    .where(and(tdb.scoped(parcelas), tdb.scoped(titulos), eq(titulos.tipo, tipo)));
  return {
    atrasadas: { quantidade: r?.atrasadasQtd ?? 0, valor: r?.atrasadasValor ?? 0 },
    proximas: { quantidade: r?.proximasQtd ?? 0, valor: r?.proximasValor ?? 0 },
    abertas: { quantidade: r?.abertasQtd ?? 0, valor: r?.abertasValor ?? 0 },
    pagasNoPeriodo: { quantidade: r?.pagasQtd ?? 0, valor: r?.pagasValor ?? 0 },
  };
}

// ---------------------------------------------------------------------------
// Referências (categoria, contato, nota fiscal, lançamento)
// ---------------------------------------------------------------------------

export function buscarCategoria(tdb: TenantDb, id: string): Promise<CategoriaRow | null> {
  return tdb.findByIdOrNull(categorias, id);
}

export function buscarContato(tdb: TenantDb, id: string): Promise<ContatoRow | null> {
  return tdb.findByIdOrNull(contatos, id);
}

export function buscarNotaFiscal(tdb: TenantDb, id: string): Promise<NotaFiscalRow | null> {
  return tdb.findByIdOrNull(notasFiscais, id);
}

export function buscarLancamento(tdb: TenantDb, id: string): Promise<LancamentoRow | null> {
  return tdb.findByIdOrNull(lancamentos, id);
}
