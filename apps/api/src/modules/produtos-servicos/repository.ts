// Acesso a dados do catálogo (produtos/serviços) e dos itens de lançamento. Único lugar do módulo
// que chama select/insert/update/delete. Sempre via forTenant (tenant_id + deleted_at IS NULL).
//
// A contagem de uso de um item do catálogo NUNCA é somada em memória: sai de um LEFT JOIN
// agregado com lancamento_itens + lancamentos, no mesmo par (tenant_id, id) da FK composta —
// nenhum item de outro MEI entra na conta nem que o id colidisse.
import { and, asc, eq, ilike, inArray, sql, type SQL } from 'drizzle-orm';

import { lancamentos } from '../../db/schema/lancamentos.js';
import {
  lancamentoItens,
  produtosServicos,
  type LancamentoItemRow,
  type ProdutoServicoRow,
} from '../../db/schema/produtos-servicos.js';
import type { TenantDb } from '../../lib/tenant-db.js';

export interface FiltroProdutosServicos {
  tipo?: ProdutoServicoRow['tipo'];
  /** Omitido = ativos e inativos; true = só ativos; false = só inativos. */
  ativo?: boolean;
  busca?: string;
}

/** Item do catálogo + quantos lançamentos (não excluídos) já o usaram. */
export interface ProdutoComUso {
  produto: ProdutoServicoRow;
  lancamentos: number;
}

function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function condicoes(tdb: TenantDb, filtro: FiltroProdutosServicos): SQL {
  const lista: SQL[] = [tdb.scoped(produtosServicos)];
  if (filtro.tipo) lista.push(eq(produtosServicos.tipo, filtro.tipo));
  if (filtro.ativo !== undefined) lista.push(eq(produtosServicos.ativo, filtro.ativo));
  if (filtro.busca) lista.push(ilike(produtosServicos.nome, `%${escaparLike(filtro.busca)}%`));
  return and(...lista) as SQL;
}

/**
 * LEFT JOIN por (tenant_id, produto_servico_id) — o mesmo par da FK composta. O segundo join
 * existe só para ignorar itens de lançamentos já excluídos (soft delete não apaga os itens).
 * count(distinct) porque o mesmo produto pode aparecer em duas linhas da mesma venda.
 */
function consultaComUso(tdb: TenantDb) {
  return tdb.exec
    .select({
      produto: produtosServicos,
      lancamentos: sql<number>`count(distinct ${lancamentos.id})::int`,
    })
    .from(produtosServicos)
    .leftJoin(
      lancamentoItens,
      and(
        eq(lancamentoItens.tenantId, produtosServicos.tenantId),
        eq(lancamentoItens.produtoServicoId, produtosServicos.id),
      ),
    )
    .leftJoin(
      lancamentos,
      and(
        eq(lancamentos.tenantId, lancamentoItens.tenantId),
        eq(lancamentos.id, lancamentoItens.lancamentoId),
        sql`${lancamentos.deletedAt} is null`,
      ),
    )
    .groupBy(produtosServicos.id);
}

export async function listarComUso(
  tdb: TenantDb,
  filtro: FiltroProdutosServicos,
): Promise<ProdutoComUso[]> {
  return consultaComUso(tdb)
    .where(condicoes(tdb, filtro))
    .orderBy(asc(produtosServicos.nome), asc(produtosServicos.id))
    .limit(500);
}

export async function buscarComUso(tdb: TenantDb, id: string): Promise<ProdutoComUso | null> {
  const linhas = await consultaComUso(tdb)
    .where(and(tdb.scoped(produtosServicos), eq(produtosServicos.id, id)))
    .limit(1);
  return linhas[0] ?? null;
}

/** Lista enxuta para o seletor de itens: só ativos, ordenados por nome (máx. 500). */
export function opcoes(
  tdb: TenantDb,
  tipo?: ProdutoServicoRow['tipo'],
): Promise<Pick<ProdutoServicoRow, 'id' | 'tipo' | 'nome' | 'precoPadrao' | 'unidade'>[]> {
  const lista: SQL[] = [tdb.scoped(produtosServicos), eq(produtosServicos.ativo, true)];
  if (tipo) lista.push(eq(produtosServicos.tipo, tipo));
  return tdb.exec
    .select({
      id: produtosServicos.id,
      tipo: produtosServicos.tipo,
      nome: produtosServicos.nome,
      precoPadrao: produtosServicos.precoPadrao,
      unidade: produtosServicos.unidade,
    })
    .from(produtosServicos)
    .where(and(...lista))
    .orderBy(asc(produtosServicos.nome), asc(produtosServicos.id))
    .limit(500);
}

export function buscar(tdb: TenantDb, id: string): Promise<ProdutoServicoRow> {
  return tdb.findById(produtosServicos, id);
}

/** Item (ativo ou inativo, não excluído) com esse nome — comparação sem diferenciar maiúsculas. */
export async function buscarPorNome(
  tdb: TenantDb,
  nome: string,
): Promise<ProdutoServicoRow | null> {
  const linhas = await tdb.exec
    .select()
    .from(produtosServicos)
    .where(and(tdb.scoped(produtosServicos), sql`lower(${produtosServicos.nome}) = lower(${nome})`))
    .limit(1);
  return linhas[0] ?? null;
}

/** Itens do catálogo do tenant entre os ids informados (valida os itens de uma venda de uma vez). */
export async function buscarPorIds(
  tdb: TenantDb,
  ids: readonly string[],
): Promise<ProdutoServicoRow[]> {
  if (ids.length === 0) return [];
  return tdb.exec
    .select()
    .from(produtosServicos)
    .where(and(tdb.scoped(produtosServicos), inArray(produtosServicos.id, [...ids])));
}

export function criar(
  tdb: TenantDb,
  valores: Omit<typeof produtosServicos.$inferInsert, 'tenantId' | 'id'>,
): Promise<ProdutoServicoRow> {
  return tdb.insert(produtosServicos, valores);
}

export function atualizar(
  tdb: TenantDb,
  id: string,
  valores: Partial<Omit<typeof produtosServicos.$inferInsert, 'tenantId' | 'id'>>,
): Promise<ProdutoServicoRow> {
  return tdb.update(produtosServicos, id, valores);
}

/**
 * Soft delete. Os itens já vendidos continuam apontando para o produto (a FK composta segue
 * válida — `scoped` filtra por deleted_at, não apaga o vínculo), então o histórico não se perde.
 */
export function excluir(tdb: TenantDb, id: string): Promise<void> {
  return tdb.softDelete(produtosServicos, id);
}

// ---------------------------------------------------------------------------
// Itens do lançamento
// ---------------------------------------------------------------------------

export interface ItemComProduto {
  item: LancamentoItemRow;
  produto: Pick<ProdutoServicoRow, 'id' | 'nome' | 'tipo' | 'unidade'> | null;
}

type LinhaBrutaItem = {
  item: LancamentoItemRow;
  produto: { id: string | null; nome: string | null; tipo: string | null; unidade: string | null };
};

function normalizarItem(linha: LinhaBrutaItem): ItemComProduto {
  const p = linha.produto;
  return {
    item: linha.item,
    produto:
      p.id && p.nome !== null
        ? {
            id: p.id,
            nome: p.nome,
            tipo: p.tipo as ProdutoServicoRow['tipo'],
            unidade: p.unidade,
          }
        : null,
  };
}

/**
 * Itens do lançamento, na ordem em que foram digitados. O JOIN é LEFT e inclui produtos já
 * excluídos (soft delete) de propósito: a venda antiga tem que continuar mostrando o que foi
 * vendido mesmo depois de o item sair do catálogo.
 */
export async function listarItens(tdb: TenantDb, lancamentoId: string): Promise<ItemComProduto[]> {
  const linhas = (await tdb.exec
    .select({
      item: lancamentoItens,
      produto: {
        id: produtosServicos.id,
        nome: produtosServicos.nome,
        tipo: produtosServicos.tipo,
        unidade: produtosServicos.unidade,
      },
    })
    .from(lancamentoItens)
    .leftJoin(
      produtosServicos,
      and(
        eq(produtosServicos.tenantId, lancamentoItens.tenantId),
        eq(produtosServicos.id, lancamentoItens.produtoServicoId),
      ),
    )
    .where(and(tdb.scoped(lancamentoItens), eq(lancamentoItens.lancamentoId, lancamentoId)))
    .orderBy(asc(lancamentoItens.ordem), asc(lancamentoItens.id))) as LinhaBrutaItem[];
  return linhas.map(normalizarItem);
}

/**
 * Mesma consulta de `listarItens` para vários lançamentos de uma vez (uma página da lista de
 * lançamentos): uma ida ao banco em vez de N.
 */
export async function listarItensDeLancamentos(
  tdb: TenantDb,
  lancamentoIds: readonly string[],
): Promise<ItemComProduto[]> {
  if (lancamentoIds.length === 0) return [];
  const linhas = (await tdb.exec
    .select({
      item: lancamentoItens,
      produto: {
        id: produtosServicos.id,
        nome: produtosServicos.nome,
        tipo: produtosServicos.tipo,
        unidade: produtosServicos.unidade,
      },
    })
    .from(lancamentoItens)
    .leftJoin(
      produtosServicos,
      and(
        eq(produtosServicos.tenantId, lancamentoItens.tenantId),
        eq(produtosServicos.id, lancamentoItens.produtoServicoId),
      ),
    )
    .where(
      and(tdb.scoped(lancamentoItens), inArray(lancamentoItens.lancamentoId, [...lancamentoIds])),
    )
    .orderBy(asc(lancamentoItens.ordem), asc(lancamentoItens.id))) as LinhaBrutaItem[];
  return linhas.map(normalizarItem);
}

export interface ItemParaGravar {
  produtoServicoId: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  ordem: number;
}

/**
 * Substitui em bloco os itens de um lançamento (apaga os atuais e insere os novos). Editar linha
 * a linha exigiria casar item antigo com item novo sem chave estável vinda da tela — e o conjunto
 * é pequeno (máx. 100 linhas). Chame sempre dentro de uma transação.
 */
export async function substituirItens(
  tdb: TenantDb,
  lancamentoId: string,
  itens: readonly ItemParaGravar[],
): Promise<void> {
  await tdb.exec
    .delete(lancamentoItens)
    .where(and(tdb.scoped(lancamentoItens), eq(lancamentoItens.lancamentoId, lancamentoId)));
  if (itens.length === 0) return;
  await tdb.exec
    .insert(lancamentoItens)
    .values(itens.map((i) => ({ ...i, tenantId: tdb.tenantId, lancamentoId })));
}
