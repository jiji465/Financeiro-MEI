// Acesso a dados de lançamentos. Único lugar do módulo (além do core.ts congelado) que chama
// select/update/delete. Sempre via forTenant (tenant_id + deleted_at IS NULL).
import type {
  FormaPagamento,
  OrigemLancamento,
  StatusLancamento,
  TipoLancamento,
} from '@meifin/shared';
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, type SQL } from 'drizzle-orm';

import { categorias } from '../../db/schema/categorias.js';
import { contatos } from '../../db/schema/contatos.js';
import { lancamentos, type LancamentoRow } from '../../db/schema/lancamentos.js';
import type { TenantDb } from '../../lib/tenant-db.js';

export interface CategoriaRefRow {
  id: string;
  nome: string;
  cor: string | null;
  icone: string | null;
}

export interface ContatoRefRow {
  id: string;
  nome: string;
  tipo: string;
}

export interface LancamentoComRefs {
  lancamento: LancamentoRow;
  categoria: CategoriaRefRow | null;
  contato: ContatoRefRow | null;
}

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
  recorrenciaId?: string;
  importacaoId?: string;
}

export type OrdenacaoLancamentos = 'data' | 'valor' | 'descricao' | 'createdAt';

export interface OpcoesListagem {
  page: number;
  pageSize: number;
  ordenarPor: OrdenacaoLancamentos;
  ordem: 'asc' | 'desc';
}

function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function condicoes(tdb: TenantDb, filtro: FiltroLancamentos): SQL {
  const lista: SQL[] = [tdb.scoped(lancamentos)];
  if (filtro.de) lista.push(gte(lancamentos.data, filtro.de));
  if (filtro.ate) lista.push(lte(lancamentos.data, filtro.ate));
  if (filtro.tipo) lista.push(eq(lancamentos.tipo, filtro.tipo));
  if (filtro.status) lista.push(eq(lancamentos.status, filtro.status));
  if (filtro.categoriaId) lista.push(eq(lancamentos.categoriaId, filtro.categoriaId));
  if (filtro.contatoId) lista.push(eq(lancamentos.contatoId, filtro.contatoId));
  if (filtro.formaPagamento) lista.push(eq(lancamentos.formaPagamento, filtro.formaPagamento));
  if (filtro.origem) lista.push(eq(lancamentos.origem, filtro.origem));
  if (filtro.recorrenciaId) lista.push(eq(lancamentos.recorrenciaId, filtro.recorrenciaId));
  if (filtro.importacaoId) lista.push(eq(lancamentos.importacaoId, filtro.importacaoId));
  if (filtro.busca) {
    const termo = `%${escaparLike(filtro.busca)}%`;
    lista.push(
      or(ilike(lancamentos.descricao, termo), ilike(lancamentos.observacoes, termo)) as SQL,
    );
  }
  return and(...lista) as SQL;
}

const SELECAO = {
  lancamento: lancamentos,
  categoria: {
    id: categorias.id,
    nome: categorias.nome,
    cor: categorias.cor,
    icone: categorias.icone,
  },
  contato: {
    id: contatos.id,
    nome: contatos.nome,
    tipo: contatos.tipo,
  },
};

type LinhaBruta = {
  lancamento: LancamentoRow;
  categoria: {
    id: string | null;
    nome: string | null;
    cor: string | null;
    icone: string | null;
  } | null;
  contato: { id: string | null; nome: string | null; tipo: string | null } | null;
};

function normalizar(linha: LinhaBruta): LancamentoComRefs {
  const categoria =
    linha.categoria && linha.categoria.id && linha.categoria.nome !== null
      ? {
          id: linha.categoria.id,
          nome: linha.categoria.nome,
          cor: linha.categoria.cor,
          icone: linha.categoria.icone,
        }
      : null;
  const contato =
    linha.contato && linha.contato.id && linha.contato.nome !== null
      ? { id: linha.contato.id, nome: linha.contato.nome, tipo: linha.contato.tipo ?? '' }
      : null;
  return { lancamento: linha.lancamento, categoria, contato };
}

function consultaComRefs(tdb: TenantDb) {
  return tdb.exec
    .select(SELECAO)
    .from(lancamentos)
    .leftJoin(
      categorias,
      and(
        eq(categorias.tenantId, lancamentos.tenantId),
        eq(categorias.id, lancamentos.categoriaId),
      ),
    )
    .leftJoin(
      contatos,
      and(eq(contatos.tenantId, lancamentos.tenantId), eq(contatos.id, lancamentos.contatoId)),
    );
}

const COLUNA_ORDEM = {
  data: lancamentos.data,
  valor: lancamentos.valor,
  descricao: lancamentos.descricao,
  createdAt: lancamentos.createdAt,
} as const;

export async function listar(
  tdb: TenantDb,
  filtro: FiltroLancamentos,
  opcoes: OpcoesListagem,
): Promise<LancamentoComRefs[]> {
  const direcao = opcoes.ordem === 'asc' ? asc : desc;
  const coluna = COLUNA_ORDEM[opcoes.ordenarPor];
  const linhas = (await consultaComRefs(tdb)
    .where(condicoes(tdb, filtro))
    .orderBy(direcao(coluna), desc(lancamentos.createdAt), desc(lancamentos.id))
    .limit(opcoes.pageSize)
    .offset((opcoes.page - 1) * opcoes.pageSize)) as LinhaBruta[];
  return linhas.map(normalizar);
}

export async function contar(tdb: TenantDb, filtro: FiltroLancamentos): Promise<number> {
  const [linha] = await tdb.exec
    .select({ n: tdb.countInt() })
    .from(lancamentos)
    .where(condicoes(tdb, filtro));
  return linha?.n ?? 0;
}

export interface TotaisPorTipo {
  receitas: number;
  despesas: number;
}

/** Soma por tipo do conjunto filtrado (não só da página). */
export async function totais(tdb: TenantDb, filtro: FiltroLancamentos): Promise<TotaisPorTipo> {
  const linhas = await tdb.exec
    .select({ tipo: lancamentos.tipo, total: tdb.sumInt(lancamentos.valor) })
    .from(lancamentos)
    .where(condicoes(tdb, filtro))
    .groupBy(lancamentos.tipo);
  const saida: TotaisPorTipo = { receitas: 0, despesas: 0 };
  for (const l of linhas) {
    if (l.tipo === 'receita') saida.receitas = l.total;
    else saida.despesas = l.total;
  }
  return saida;
}

export interface LinhaResumo {
  tipo: TipoLancamento;
  status: StatusLancamento;
  total: number;
  quantidade: number;
}

export async function resumo(tdb: TenantDb, de: string, ate: string): Promise<LinhaResumo[]> {
  return tdb.exec
    .select({
      tipo: lancamentos.tipo,
      status: lancamentos.status,
      total: tdb.sumInt(lancamentos.valor),
      quantidade: tdb.countInt(),
    })
    .from(lancamentos)
    .where(condicoes(tdb, { de, ate }))
    .groupBy(lancamentos.tipo, lancamentos.status);
}

export function buscar(tdb: TenantDb, id: string): Promise<LancamentoRow> {
  return tdb.findById(lancamentos, id);
}

export async function buscarComRefs(tdb: TenantDb, id: string): Promise<LancamentoComRefs | null> {
  const [linha] = (await consultaComRefs(tdb)
    .where(and(tdb.scoped(lancamentos), eq(lancamentos.id, id)))
    .limit(1)) as LinhaBruta[];
  return linha ? normalizar(linha) : null;
}

export function atualizar(
  tdb: TenantDb,
  id: string,
  valores: Partial<Omit<typeof lancamentos.$inferInsert, 'tenantId' | 'id'>>,
): Promise<LancamentoRow> {
  return tdb.update(lancamentos, id, valores);
}

/** Hashes (dedupe de importação) já presentes no tenant entre os informados. */
export async function hashesExistentes(tdb: TenantDb, hashes: string[]): Promise<Set<string>> {
  if (hashes.length === 0) return new Set();
  const linhas = await tdb.exec
    .select({ hash: lancamentos.hashImportacao })
    .from(lancamentos)
    .where(and(tdb.scoped(lancamentos), inArray(lancamentos.hashImportacao, hashes)));
  return new Set(linhas.map((l) => l.hash).filter((h): h is string => h !== null));
}

/** Ids dos lançamentos (não excluídos) criados por uma importação. */
export async function idsDaImportacao(tdb: TenantDb, importacaoId: string): Promise<string[]> {
  const linhas = await tdb.exec
    .select({ id: lancamentos.id })
    .from(lancamentos)
    .where(and(tdb.scoped(lancamentos), eq(lancamentos.importacaoId, importacaoId)));
  return linhas.map((l) => l.id);
}

/** Categoria do tenant por id (para validar tipo em PATCH sem passar pelo core). */
export function buscarCategoria(tdb: TenantDb, id: string) {
  return tdb.findByIdOrNull(categorias, id);
}

export function buscarContato(tdb: TenantDb, id: string) {
  return tdb.findByIdOrNull(contatos, id);
}

/** Categorias ativas do tenant (sugestão de categoria na importação). */
export function listarCategoriasAtivas(tdb: TenantDb) {
  return tdb.exec
    .select({ id: categorias.id, nome: categorias.nome, tipo: categorias.tipo })
    .from(categorias)
    .where(and(tdb.scoped(categorias), eq(categorias.ativo, true)))
    .orderBy(asc(categorias.ordem), asc(categorias.nome));
}

/** Contatos ativos do tenant (casamento por nome na importação). */
export function listarContatosAtivos(tdb: TenantDb) {
  return tdb.exec
    .select({ id: contatos.id, nome: contatos.nome, tipo: contatos.tipo })
    .from(contatos)
    .where(and(tdb.scoped(contatos), eq(contatos.ativo, true)))
    .orderBy(asc(contatos.nome));
}

/**
 * Remove o vínculo com uma recorrência prestes a ser excluída (`recorrencia_id = NULL`).
 * Não dá para confiar no `ON DELETE SET NULL` da FK composta `(tenant_id, recorrencia_id)`:
 * no Postgres, `SET NULL` num FK multi-coluna zera TODAS as colunas referenciadas — inclusive
 * `tenant_id`, que é `NOT NULL` — e a exclusão falha com 23502 (not_null_violation). Inclui
 * lançamentos já soft-deletados para não sobrar referência pendurada.
 */
export async function desvincularRecorrencia(tdb: TenantDb, recorrenciaId: string): Promise<void> {
  await tdb.exec
    .update(lancamentos)
    .set({ recorrenciaId: null })
    .where(
      and(
        tdb.scoped(lancamentos, { incluirExcluidos: true }),
        eq(lancamentos.recorrenciaId, recorrenciaId),
      ),
    );
}

/** Mesma lógica de `desvincularRecorrencia`, para `importacao_id`. */
export async function desvincularImportacao(tdb: TenantDb, importacaoId: string): Promise<void> {
  await tdb.exec
    .update(lancamentos)
    .set({ importacaoId: null })
    .where(
      and(
        tdb.scoped(lancamentos, { incluirExcluidos: true }),
        eq(lancamentos.importacaoId, importacaoId),
      ),
    );
}
