// Regras do catálogo (produtos/serviços) e dos itens de lançamento.
//
// Catálogo: nome único por MEI (409 no campo "nome"), soft delete que preserva o histórico das
// vendas já feitas, preço padrão é só sugestão (nunca trava o valor da venda).
//
// Itens: o total de cada linha é SEMPRE recalculado aqui (`totalDoItem`, half-up ao centavo) —
// o cliente manda quantidade e valor unitário, nunca o total — e a soma dos totais tem que bater
// com o valor do lançamento, senão 422 no campo "itens".
//
// Contratos: @meifin/shared/schemas/produtos-servicos.
import {
  formatBRL,
  totalDoItem,
  type AtualizarProdutoServicoBody,
  type CriarProdutoServicoBody,
  type LancamentoItemDto,
  type LancamentoItemInput,
  type ListarProdutosServicosQuery,
  type ProdutoServicoDto,
  type ProdutoServicoOpcaoDto,
  type TipoProdutoServico,
} from '@meifin/shared';

import type { ProdutoServicoRow } from '../../db/schema/produtos-servicos.js';
import { ConflictError, NotFoundError, UnprocessableError } from '../../lib/errors.js';
import { isoTimestamp } from '../../lib/hoje.js';
import type { TenantDb } from '../../lib/tenant-db.js';
import * as repo from './repository.js';

export function toProdutoServicoDto(linha: repo.ProdutoComUso): ProdutoServicoDto {
  const p = linha.produto;
  return {
    id: p.id,
    tipo: p.tipo,
    nome: p.nome,
    descricao: p.descricao,
    precoPadrao: p.precoPadrao,
    unidade: p.unidade,
    ativo: p.ativo,
    lancamentos: linha.lancamentos,
    createdAt: isoTimestamp(p.createdAt) ?? p.createdAt,
    updatedAt: isoTimestamp(p.updatedAt) ?? p.updatedAt,
  };
}

export function toProdutoServicoOpcaoDto(
  row: Pick<ProdutoServicoRow, 'id' | 'tipo' | 'nome' | 'precoPadrao' | 'unidade'>,
): ProdutoServicoOpcaoDto {
  return {
    id: row.id,
    tipo: row.tipo,
    nome: row.nome,
    precoPadrao: row.precoPadrao,
    unidade: row.unidade,
  };
}

export function toLancamentoItemDto(linha: repo.ItemComProduto): LancamentoItemDto {
  const i = linha.item;
  return {
    id: i.id,
    produtoServicoId: i.produtoServicoId,
    produtoServico: linha.produto
      ? {
          id: linha.produto.id,
          nome: linha.produto.nome,
          tipo: linha.produto.tipo,
          unidade: linha.produto.unidade,
        }
      : null,
    quantidade: i.quantidade,
    valorUnitario: i.valorUnitario,
    valorTotal: i.valorTotal,
  };
}

async function garantirNomeUnico(tdb: TenantDb, nome: string, ignorarId?: string) {
  const existente = await repo.buscarPorNome(tdb, nome);
  if (existente && existente.id !== ignorarId) {
    throw new ConflictError(`Já existe um item chamado "${existente.nome}"`, [
      { campo: 'nome', mensagem: 'Já existe um produto ou serviço com esse nome' },
    ]);
  }
}

async function obterComUso(tdb: TenantDb, id: string): Promise<ProdutoServicoDto> {
  const linha = await repo.buscarComUso(tdb, id);
  if (!linha) throw new NotFoundError('Produto ou serviço não encontrado');
  return toProdutoServicoDto(linha);
}

export async function listar(
  tdb: TenantDb,
  query: ListarProdutosServicosQuery,
): Promise<ProdutoServicoDto[]> {
  const linhas = await repo.listarComUso(tdb, {
    tipo: query.tipo,
    ativo: query.ativo,
    busca: query.busca,
  });
  return linhas.map(toProdutoServicoDto);
}

export async function opcoes(
  tdb: TenantDb,
  tipo?: TipoProdutoServico,
): Promise<ProdutoServicoOpcaoDto[]> {
  const linhas = await repo.opcoes(tdb, tipo);
  return linhas.map(toProdutoServicoOpcaoDto);
}

export function obter(tdb: TenantDb, id: string): Promise<ProdutoServicoDto> {
  return obterComUso(tdb, id);
}

export async function criar(
  tdb: TenantDb,
  body: CriarProdutoServicoBody,
): Promise<ProdutoServicoDto> {
  await garantirNomeUnico(tdb, body.nome);
  const criado = await repo.criar(tdb, {
    tipo: body.tipo,
    nome: body.nome,
    descricao: body.descricao ?? null,
    precoPadrao: body.precoPadrao ?? null,
    unidade: body.unidade ?? null,
    ativo: true,
  });
  return obterComUso(tdb, criado.id);
}

export async function atualizar(
  tdb: TenantDb,
  id: string,
  body: AtualizarProdutoServicoBody,
): Promise<ProdutoServicoDto> {
  const atual = await repo.buscar(tdb, id);

  const valores: Partial<Omit<ProdutoServicoRow, 'id' | 'tenantId'>> = {};
  if (body.nome !== undefined && body.nome !== atual.nome) {
    await garantirNomeUnico(tdb, body.nome, id);
    valores.nome = body.nome;
  }
  if (body.tipo !== undefined) valores.tipo = body.tipo;
  if (body.descricao !== undefined) valores.descricao = body.descricao ?? null;
  if (body.precoPadrao !== undefined) valores.precoPadrao = body.precoPadrao ?? null;
  if (body.unidade !== undefined) valores.unidade = body.unidade ?? null;
  if (body.ativo !== undefined) valores.ativo = body.ativo;

  if (Object.keys(valores).length > 0) await repo.atualizar(tdb, id, valores);
  return obterComUso(tdb, id);
}

/**
 * Soft delete: o item some das listas e dos seletores, mas as vendas já registradas continuam
 * mostrando o que foi vendido (e com os mesmos valores).
 */
export async function excluir(tdb: TenantDb, id: string): Promise<void> {
  await repo.excluir(tdb, id);
}

// ---------------------------------------------------------------------------
// Itens do lançamento
// ---------------------------------------------------------------------------

/** Itens já gravados de um lançamento (vazio quando ele não é uma venda de catálogo). */
export async function itensDoLancamento(
  tdb: TenantDb,
  lancamentoId: string,
): Promise<LancamentoItemDto[]> {
  const linhas = await repo.listarItens(tdb, lancamentoId);
  return linhas.map(toLancamentoItemDto);
}

/**
 * Itens de vários lançamentos de uma vez, indexados pelo id do lançamento (uma consulta só para
 * a página inteira da lista). Lançamento sem itens não aparece no mapa.
 */
export async function itensPorLancamento(
  tdb: TenantDb,
  lancamentoIds: readonly string[],
): Promise<Map<string, LancamentoItemDto[]>> {
  const linhas = await repo.listarItensDeLancamentos(tdb, lancamentoIds);
  const mapa = new Map<string, LancamentoItemDto[]>();
  for (const linha of linhas) {
    const lista = mapa.get(linha.item.lancamentoId);
    if (lista) lista.push(toLancamentoItemDto(linha));
    else mapa.set(linha.item.lancamentoId, [toLancamentoItemDto(linha)]);
  }
  return mapa;
}

/** Itens de entrada + total calculado de cada linha e da venda inteira. */
export interface ItensCalculados {
  linhas: repo.ItemParaGravar[];
  total: number;
}

/**
 * Calcula o total de cada linha e o total do conjunto. Regra de arredondamento, uma só, em
 * `totalDoItem`: round(quantidade × valorUnitario / 1000) half-up (meio para cima) ao centavo,
 * feita em aritmética inteira. O total da venda é a SOMA DOS TOTAIS JÁ ARREDONDADOS — e não o
 * arredondamento da soma — para que a conta feita na tela, linha a linha, dê exatamente o mesmo
 * número que a conta feita aqui.
 */
export function calcularItens(itens: readonly LancamentoItemInput[]): ItensCalculados {
  const linhas = itens.map((item, ordem) => ({
    produtoServicoId: item.produtoServicoId,
    quantidade: item.quantidade,
    valorUnitario: item.valorUnitario,
    valorTotal: totalDoItem(item.quantidade, item.valorUnitario),
    ordem,
  }));
  return { linhas, total: linhas.reduce((soma, l) => soma + l.valorTotal, 0) };
}

/**
 * Confere que todo produto/serviço citado existe neste MEI e não está excluído. Item de outro
 * tenant → 404, nunca 403: a API não confirma que o id existe em outro lugar. A FK composta
 * (tenant_id, produto_servico_id) barraria de qualquer jeito na hora do INSERT; isto aqui só
 * troca um erro de banco por uma mensagem que o dono entende.
 *
 * Item inativo não é recusado, pela mesma razão que conta bancária e categoria inativas não são:
 * "inativo" aqui quer dizer "sumiu dos seletores", não "proibido" — e um lançamento antigo sendo
 * corrigido pode legitimamente citar um item que saiu do catálogo depois.
 */
async function validarProdutos(
  tdb: TenantDb,
  itens: readonly LancamentoItemInput[],
): Promise<void> {
  const ids = [...new Set(itens.map((i) => i.produtoServicoId))];
  const encontrados = await repo.buscarPorIds(tdb, ids);
  const conhecidos = new Set(encontrados.map((p) => p.id));
  for (const id of ids) {
    if (!conhecidos.has(id)) throw new NotFoundError('Produto ou serviço não encontrado');
  }
}

/**
 * Grava os itens de um lançamento e garante a consistência com o valor dele: se há itens, a soma
 * dos totais TEM que ser igual ao valor do lançamento. Lançamento sem itens continua válido — a
 * esmagadora maioria dos lançamentos não é venda de catálogo — e `itens: []` limpa os itens.
 *
 * Chame sempre dentro da transação que criou/atualizou o lançamento: se a soma não fechar, nada
 * do lançamento pode sobrar gravado.
 */
export async function sincronizarItens(
  tdb: TenantDb,
  lancamentoId: string,
  valorLancamento: number,
  itens: readonly LancamentoItemInput[],
): Promise<void> {
  if (itens.length === 0) {
    await repo.substituirItens(tdb, lancamentoId, []);
    return;
  }
  await validarProdutos(tdb, itens);
  const { linhas, total } = calcularItens(itens);
  if (total !== valorLancamento) {
    throw new UnprocessableError(
      `A soma dos itens (${formatBRL(total)}) não bate com o valor do lançamento (${formatBRL(
        valorLancamento,
      )}).`,
      [
        {
          campo: 'itens',
          mensagem: `A soma dos itens é ${formatBRL(total)} e o valor do lançamento é ${formatBRL(
            valorLancamento,
          )}`,
        },
      ],
    );
  }
  await repo.substituirItens(tdb, lancamentoId, linhas);
}
