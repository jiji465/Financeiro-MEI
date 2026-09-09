// Acesso a dados de notas fiscais. Único lugar do módulo que chama select/insert/update.
import type { IsoDate } from '@meifin/shared';
import { and, asc, desc, eq, gte, ilike, isNull, lte, ne, or, sql, type SQL } from 'drizzle-orm';

import { categorias, type CategoriaRow } from '../../db/schema/categorias.js';
import { contatos, type ContatoRow } from '../../db/schema/contatos.js';
import { lancamentos, type LancamentoRow } from '../../db/schema/lancamentos.js';
import { notasFiscais, type NotaFiscalRow } from '../../db/schema/notas-fiscais.js';
import type { TenantDb } from '../../lib/tenant-db.js';

export type ContatoRef = Pick<ContatoRow, 'id' | 'nome' | 'tipo'>;

export interface NotaComRefs {
  nota: NotaFiscalRow;
  contato: ContatoRef | null;
}

const contatoRefCols = { id: contatos.id, nome: contatos.nome, tipo: contatos.tipo };
const juncaoContato = and(
  eq(contatos.tenantId, notasFiscais.tenantId),
  eq(contatos.id, notasFiscais.contatoId),
);

function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export interface FiltroNotas {
  tipo?: NotaFiscalRow['tipo'];
  status?: NotaFiscalRow['status'];
  contatoId?: string;
  de?: IsoDate;
  ate?: IsoDate;
  busca?: string;
  semLancamento?: boolean;
  ordenarPor: 'dataEmissao' | 'numero' | 'valor' | 'createdAt';
  ordem: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

const ORDEM = {
  dataEmissao: notasFiscais.dataEmissao,
  numero: notasFiscais.numero,
  valor: notasFiscais.valor,
  createdAt: notasFiscais.createdAt,
} as const;

function condicoes(tdb: TenantDb, f: FiltroNotas): SQL[] {
  const c = [tdb.scoped(notasFiscais)];
  if (f.tipo) c.push(eq(notasFiscais.tipo, f.tipo));
  if (f.status) c.push(eq(notasFiscais.status, f.status));
  if (f.contatoId) c.push(eq(notasFiscais.contatoId, f.contatoId));
  if (f.de) c.push(gte(notasFiscais.dataEmissao, f.de));
  if (f.ate) c.push(lte(notasFiscais.dataEmissao, f.ate));
  if (f.semLancamento === true) c.push(isNull(notasFiscais.lancamentoId));
  if (f.busca) {
    const termo = `%${escaparLike(f.busca)}%`;
    c.push(or(ilike(notasFiscais.numero, termo), ilike(notasFiscais.descricao, termo)) as SQL);
  }
  return c;
}

export async function listar(
  tdb: TenantDb,
  f: FiltroNotas,
): Promise<{ itens: NotaComRefs[]; total: number; totalValor: number }> {
  const where = and(...condicoes(tdb, f));
  const direcao = f.ordem === 'asc' ? asc : desc;
  const itens = await tdb.exec
    .select({ nota: notasFiscais, contato: contatoRefCols })
    .from(notasFiscais)
    .leftJoin(contatos, juncaoContato)
    .where(where)
    .orderBy(direcao(ORDEM[f.ordenarPor]), desc(notasFiscais.createdAt))
    .limit(f.pageSize)
    .offset((f.page - 1) * f.pageSize);
  const [agregados] = await tdb.exec
    .select({ n: tdb.countInt(), valor: tdb.sumInt(notasFiscais.valor) })
    .from(notasFiscais)
    .where(where);
  return { itens, total: agregados?.n ?? 0, totalValor: agregados?.valor ?? 0 };
}

export async function buscar(tdb: TenantDb, id: string): Promise<NotaComRefs | null> {
  const linhas = await tdb.exec
    .select({ nota: notasFiscais, contato: contatoRefCols })
    .from(notasFiscais)
    .leftJoin(contatos, juncaoContato)
    .where(and(tdb.scoped(notasFiscais), eq(notasFiscais.id, id)))
    .limit(1);
  return linhas[0] ?? null;
}

/** Nota ativa com o mesmo (tipo, série, número), opcionalmente ignorando um id (PATCH). */
export async function buscarDuplicada(
  tdb: TenantDb,
  tipo: NotaFiscalRow['tipo'],
  serie: string,
  numero: string,
  ignorarId?: string,
): Promise<NotaFiscalRow | null> {
  const c = [
    tdb.scoped(notasFiscais),
    eq(notasFiscais.tipo, tipo),
    eq(notasFiscais.serie, serie),
    eq(notasFiscais.numero, numero),
  ];
  if (ignorarId) c.push(ne(notasFiscais.id, ignorarId));
  const linhas = await tdb.exec
    .select()
    .from(notasFiscais)
    .where(and(...c))
    .limit(1);
  return linhas[0] ?? null;
}

/** Outra nota ativa já vinculada ao lançamento. */
export async function buscarPorLancamento(
  tdb: TenantDb,
  lancamentoId: string,
  ignorarId?: string,
): Promise<NotaFiscalRow | null> {
  const c = [tdb.scoped(notasFiscais), eq(notasFiscais.lancamentoId, lancamentoId)];
  if (ignorarId) c.push(ne(notasFiscais.id, ignorarId));
  const linhas = await tdb.exec
    .select()
    .from(notasFiscais)
    .where(and(...c))
    .limit(1);
  return linhas[0] ?? null;
}

export function criar(
  tdb: TenantDb,
  valores: Omit<typeof notasFiscais.$inferInsert, 'tenantId' | 'id'>,
): Promise<NotaFiscalRow> {
  return tdb.insert(notasFiscais, valores);
}

export function atualizar(
  tdb: TenantDb,
  id: string,
  valores: Partial<Omit<typeof notasFiscais.$inferInsert, 'tenantId' | 'id'>>,
): Promise<NotaFiscalRow> {
  return tdb.update(notasFiscais, id, valores);
}

export function excluir(tdb: TenantDb, id: string): Promise<void> {
  return tdb.softDelete(notasFiscais, id);
}

export interface GrupoNotas {
  quantidade: number;
  valor: number;
}

export interface ResumoAno {
  emitidas: GrupoNotas;
  canceladas: GrupoNotas;
  semLancamento: GrupoNotas;
  porTipo: { tipo: NotaFiscalRow['tipo']; quantidade: number; valor: number }[];
  porMes: { mes: number; quantidade: number; valor: number }[];
}

export async function resumo(tdb: TenantDb, de: IsoDate, ate: IsoDate): Promise<ResumoAno> {
  const base = and(
    tdb.scoped(notasFiscais),
    gte(notasFiscais.dataEmissao, de),
    lte(notasFiscais.dataEmissao, ate),
  );
  const emitida = sql`${notasFiscais.status} = 'emitida'`;
  const cancelada = sql`${notasFiscais.status} = 'cancelada'`;
  const semLanc = sql`${emitida} and ${notasFiscais.lancamentoId} is null`;
  const qtd = (cond: SQL) => sql<number>`count(*) filter (where ${cond})::int`;
  const soma = (cond: SQL) =>
    sql<number>`coalesce(sum(case when ${cond} then ${notasFiscais.valor} else 0 end), 0)::int`;

  const [totais] = await tdb.exec
    .select({
      emitidasQtd: qtd(emitida),
      emitidasValor: soma(emitida),
      canceladasQtd: qtd(cancelada),
      canceladasValor: soma(cancelada),
      semLancQtd: qtd(semLanc),
      semLancValor: soma(semLanc),
    })
    .from(notasFiscais)
    .where(base);

  const porTipo = await tdb.exec
    .select({
      tipo: notasFiscais.tipo,
      quantidade: tdb.countInt(),
      valor: tdb.sumInt(notasFiscais.valor),
    })
    .from(notasFiscais)
    .where(and(base, emitida))
    .groupBy(notasFiscais.tipo);

  const mesExpr = sql<number>`extract(month from ${notasFiscais.dataEmissao})::int`;
  const porMes = await tdb.exec
    .select({ mes: mesExpr, quantidade: tdb.countInt(), valor: tdb.sumInt(notasFiscais.valor) })
    .from(notasFiscais)
    .where(and(base, emitida))
    .groupBy(mesExpr);

  return {
    emitidas: { quantidade: totais?.emitidasQtd ?? 0, valor: totais?.emitidasValor ?? 0 },
    canceladas: { quantidade: totais?.canceladasQtd ?? 0, valor: totais?.canceladasValor ?? 0 },
    semLancamento: { quantidade: totais?.semLancQtd ?? 0, valor: totais?.semLancValor ?? 0 },
    porTipo,
    porMes,
  };
}

// Referências
export function buscarContato(tdb: TenantDb, id: string): Promise<ContatoRow | null> {
  return tdb.findByIdOrNull(contatos, id);
}

export function buscarCategoria(tdb: TenantDb, id: string): Promise<CategoriaRow | null> {
  return tdb.findByIdOrNull(categorias, id);
}

export function buscarLancamento(tdb: TenantDb, id: string): Promise<LancamentoRow | null> {
  return tdb.findByIdOrNull(lancamentos, id);
}

export async function buscarRefsDoLancamento(
  tdb: TenantDb,
  l: LancamentoRow,
): Promise<{
  categoria: Pick<CategoriaRow, 'id' | 'nome' | 'cor' | 'icone'> | null;
  contato: ContatoRef | null;
}> {
  const categoria = await tdb.findByIdOrNull(categorias, l.categoriaId);
  const contato = l.contatoId ? await tdb.findByIdOrNull(contatos, l.contatoId) : null;
  return {
    categoria: categoria
      ? { id: categoria.id, nome: categoria.nome, cor: categoria.cor, icone: categoria.icone }
      : null,
    contato: contato ? { id: contato.id, nome: contato.nome, tipo: contato.tipo } : null,
  };
}
