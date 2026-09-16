// Regras de lançamentos: listagem com totais, criação (via core congelado), edição restrita para
// origem das/baixa, exclusão bloqueada quando vinculado a parcela/DAS, pagar, anexos e resumo.
import {
  LABEL_ORIGEM_LANCAMENTO,
  anexoUploadMeta,
  inicioMes,
  type AtualizarLancamentoBody,
  type CriarLancamentoBody,
  type LancamentoDto,
  type LancamentoItemDto,
  type ListaLancamentosResponse,
  type ListarLancamentosQuery,
  type PagarLancamentoBody,
  type ResumoLancamentosDto,
  type ResumoLancamentosQuery,
} from '@meifin/shared';

import type { Database, DbExecutor } from '../../db/index.js';
import type { LancamentoRow } from '../../db/schema/lancamentos.js';
import {
  ConflictError,
  NotFoundError,
  UnprocessableError,
  ValidationError,
} from '../../lib/errors.js';
import type { HojeFn } from '../../lib/hoje.js';
import { isoTimestamp } from '../../lib/hoje.js';
import { parsePaginacao } from '../../lib/pagination.js';
import type { ArquivoEntrada, FileStorage } from '../../lib/storage.js';
import { forTenant, type TenantDb } from '../../lib/tenant-db.js';
import {
  itensDoLancamento,
  itensPorLancamento,
  sincronizarItens,
} from '../produtos-servicos/index.js';
import { criarLancamentoInterno, excluirLancamentoInterno } from './core.js';
import * as recRepo from './recorrencias.repository.js';
import { gerarRecorrenciasPendentes, validarReferencias } from './recorrencias.service.js';
import * as repo from './repository.js';

/** Dependências que as rotas montam por requisição. */
export interface LancamentosCtx {
  tenantId: string;
  exec: DbExecutor;
  withTx: Database['withTx'];
  hoje: HojeFn;
  storage: FileStorage;
}

/** Origens cujo lançamento é controlado por outro módulo: só descrição/observações mudam. */
const ORIGENS_RESTRITAS = new Set<LancamentoRow['origem']>(['das', 'baixa']);
const CAMPOS_LIVRES = new Set(['descricao', 'observacoes']);

export function toLancamentoDto(
  l: repo.LancamentoComRefs,
  /** Itens do catálogo já carregados; vazio quando o lançamento não é venda de catálogo. */
  itens: LancamentoItemDto[] = [],
): LancamentoDto {
  const row = l.lancamento;
  return {
    id: row.id,
    tipo: row.tipo,
    data: row.data,
    valor: row.valor,
    descricao: row.descricao,
    categoriaId: row.categoriaId,
    categoria: l.categoria,
    contatoId: row.contatoId,
    contato: l.contato,
    contaBancariaId: row.contaBancariaId,
    contaBancaria: l.contaBancaria,
    formaPagamento: row.formaPagamento,
    status: row.status,
    dataPagamento: row.dataPagamento,
    observacoes: row.observacoes,
    anexo:
      row.anexoPath && row.anexoNome
        ? {
            nome: row.anexoNome,
            mime: row.anexoMime ?? 'application/octet-stream',
            tamanho: row.anexoTamanho ?? 0,
          }
        : null,
    origem: row.origem,
    recorrenciaId: row.recorrenciaId,
    competencia: row.competencia ? row.competencia.slice(0, 7) : null,
    parcelaId: row.parcelaId,
    importacaoId: row.importacaoId,
    itens,
    createdAt: isoTimestamp(row.createdAt) ?? row.createdAt,
    updatedAt: isoTimestamp(row.updatedAt) ?? row.updatedAt,
  };
}

function tdbDe(ctx: LancamentosCtx, exec: DbExecutor = ctx.exec): TenantDb {
  return forTenant(exec, ctx.tenantId);
}

/** Conta bancária existe no tenant e não está excluída (senão 404, nunca 403). */
async function validarContaBancaria(tdb: TenantDb, contaBancariaId: string): Promise<void> {
  const conta = await repo.buscarContaBancaria(tdb, contaBancariaId);
  if (!conta) throw new NotFoundError('Conta bancária não encontrada');
}

async function obterDto(tdb: TenantDb, id: string): Promise<LancamentoDto> {
  const linha = await repo.buscarComRefs(tdb, id);
  if (!linha) throw new NotFoundError('Lançamento não encontrado');
  return toLancamentoDto(linha, await itensDoLancamento(tdb, id));
}

export async function listar(
  ctx: LancamentosCtx,
  query: ListarLancamentosQuery,
): Promise<ListaLancamentosResponse> {
  const tdb = tdbDe(ctx);
  const { page, pageSize } = parsePaginacao(query);
  const filtro: repo.FiltroLancamentos = {
    de: query.de,
    ate: query.ate,
    tipo: query.tipo,
    status: query.status,
    categoriaId: query.categoriaId,
    contatoId: query.contatoId,
    contaBancariaId: query.contaBancariaId,
    formaPagamento: query.formaPagamento,
    origem: query.origem,
    busca: query.busca,
  };
  const [linhas, total, somas] = await Promise.all([
    repo.listar(tdb, filtro, { page, pageSize, ordenarPor: query.ordenarPor, ordem: query.ordem }),
    repo.contar(tdb, filtro),
    repo.totais(tdb, filtro),
  ]);
  // Uma consulta só carrega os itens da página inteira (em vez de uma por linha).
  const itens = await itensPorLancamento(
    tdb,
    linhas.map((l) => l.lancamento.id),
  );
  return {
    data: linhas.map((l) => toLancamentoDto(l, itens.get(l.lancamento.id) ?? [])),
    meta: { page, pageSize, total },
    totais: {
      receitas: somas.receitas,
      despesas: somas.despesas,
      saldo: somas.receitas - somas.despesas,
    },
  };
}

export function obter(ctx: LancamentosCtx, id: string): Promise<LancamentoDto> {
  return obterDto(tdbDe(ctx), id);
}

/**
 * POST /lancamentos. Com `recorrencia`, cria a recorrência (data de início = data do lançamento),
 * o primeiro lançamento com origem "recorrencia" e materializa as competências pendentes.
 *
 * Com `itens`, o lançamento e os itens são gravados na MESMA transação: se a soma dos itens não
 * fechar com o valor, o 422 tem que desfazer também o lançamento (senão sobraria uma venda sem
 * os itens que a explicam). As repetições futuras da recorrência nascem sem itens — a quantidade
 * vendida muda a cada mês, então repetir a composição da primeira venda seria inventar dado.
 */
export async function criar(
  ctx: LancamentosCtx,
  body: CriarLancamentoBody,
): Promise<LancamentoDto> {
  const base = {
    tipo: body.tipo,
    data: body.data,
    valor: body.valor,
    descricao: body.descricao,
    categoriaId: body.categoriaId,
    contatoId: body.contatoId ?? null,
    contaBancariaId: body.contaBancariaId ?? null,
    formaPagamento: body.formaPagamento ?? ('pix' as const),
    status: body.status,
    dataPagamento: body.dataPagamento ?? null,
    observacoes: body.observacoes ?? null,
  };
  const itens = body.itens ?? [];

  if (!body.recorrencia) {
    if (itens.length === 0) {
      const criado = await criarLancamentoInterno(ctx.exec, ctx.tenantId, {
        ...base,
        origem: 'manual',
      });
      return obterDto(tdbDe(ctx), criado.id);
    }
    const id = await ctx.withTx(async (tx) => {
      const criado = await criarLancamentoInterno(tx, ctx.tenantId, { ...base, origem: 'manual' });
      await sincronizarItens(tdbDe(ctx, tx), criado.id, base.valor, itens);
      return criado.id;
    });
    return obterDto(tdbDe(ctx), id);
  }

  const recorrencia = body.recorrencia;
  const id = await ctx.withTx(async (tx) => {
    const tdb = tdbDe(ctx, tx);
    await validarReferencias(tdb, body.tipo, body.categoriaId, body.contatoId);
    if (body.contaBancariaId) await validarContaBancaria(tdb, body.contaBancariaId);
    const competencia = inicioMes(body.data);
    const rec = await recRepo.criar(tdb, {
      tipo: body.tipo,
      valor: body.valor,
      descricao: body.descricao,
      categoriaId: body.categoriaId,
      contatoId: body.contatoId ?? null,
      // Sem isto, só o primeiro mês nasceria com conta: a materialização dos meses seguintes
      // lê a conta daqui, não do lançamento.
      contaBancariaId: body.contaBancariaId ?? null,
      formaPagamento: base.formaPagamento,
      diaDoMes: recorrencia.diaDoMes,
      dataInicio: body.data,
      dataFim: recorrencia.dataFim ?? null,
      ativo: true,
      ultimaCompetencia: competencia,
    });
    const primeiro = await criarLancamentoInterno(tx, ctx.tenantId, {
      ...base,
      origem: 'recorrencia',
      recorrenciaId: rec.id,
      competencia,
    });
    if (itens.length > 0) await sincronizarItens(tdb, primeiro.id, base.valor, itens);
    await gerarRecorrenciasPendentes(tx, ctx.tenantId, ctx.hoje(), { recorrenciaId: rec.id });
    return primeiro.id;
  });
  return obterDto(tdbDe(ctx), id);
}

export async function atualizar(
  ctx: LancamentosCtx,
  id: string,
  body: AtualizarLancamentoBody,
): Promise<LancamentoDto> {
  const tdb = tdbDe(ctx);
  const atual = await repo.buscar(tdb, id);

  if (ORIGENS_RESTRITAS.has(atual.origem)) {
    const proibidos = Object.entries(body)
      .filter(([campo, valor]) => valor !== undefined && !CAMPOS_LIVRES.has(campo))
      .map(([campo]) => campo);
    if (proibidos.length > 0) {
      const origem = LABEL_ORIGEM_LANCAMENTO[atual.origem].toLowerCase();
      throw new UnprocessableError(
        `Lançamento de ${origem}: só descrição e observações podem ser alteradas aqui`,
        proibidos.map((campo) => ({
          campo,
          mensagem: 'Campo controlado pelo módulo de origem',
        })),
      );
    }
  }

  const tipo = body.tipo ?? atual.tipo;
  const categoriaId = body.categoriaId ?? atual.categoriaId;
  const contatoId = body.contatoId !== undefined ? body.contatoId : atual.contatoId;
  const contaBancariaId =
    body.contaBancariaId !== undefined ? body.contaBancariaId : atual.contaBancariaId;
  if (body.tipo !== undefined || body.categoriaId !== undefined || body.contatoId) {
    await validarReferencias(tdb, tipo, categoriaId, body.contatoId ?? null);
  }
  if (body.contaBancariaId) await validarContaBancaria(tdb, body.contaBancariaId);

  const data = body.data ?? atual.data;
  const status = body.status ?? atual.status;
  let dataPagamento = body.dataPagamento !== undefined ? body.dataPagamento : atual.dataPagamento;
  if (status === 'pendente') dataPagamento = null;
  else if (!dataPagamento) dataPagamento = data;

  const valores = {
    tipo,
    data,
    categoriaId,
    contatoId,
    contaBancariaId,
    status,
    dataPagamento,
    ...(body.valor !== undefined ? { valor: body.valor } : {}),
    ...(body.descricao !== undefined ? { descricao: body.descricao } : {}),
    ...(body.formaPagamento !== undefined ? { formaPagamento: body.formaPagamento ?? 'pix' } : {}),
    ...(body.observacoes !== undefined ? { observacoes: body.observacoes } : {}),
  };

  // Itens: `body.itens` ausente mantém os que já estão lá; `[]` limpa. Mexer só no VALOR de um
  // lançamento que tem itens também obriga a reconferir a soma — senão a venda passaria a valer
  // um número que os próprios itens dela não explicam.
  const itensAtuais = await itensDoLancamento(tdb, id);
  const valorFinal = body.valor ?? atual.valor;
  const precisaRegravarItens =
    body.itens !== undefined || (itensAtuais.length > 0 && valorFinal !== atual.valor);

  if (!precisaRegravarItens) {
    await repo.atualizar(tdb, id, valores);
    return obterDto(tdb, id);
  }

  const itensFinais =
    body.itens ??
    itensAtuais.map((i) => ({
      produtoServicoId: i.produtoServicoId,
      quantidade: i.quantidade,
      valorUnitario: i.valorUnitario,
    }));
  await ctx.withTx(async (tx) => {
    const tdbTx = tdbDe(ctx, tx);
    await repo.atualizar(tdbTx, id, valores);
    await sincronizarItens(tdbTx, id, valorFinal, itensFinais);
  });
  return obterDto(tdb, id);
}

export async function pagar(
  ctx: LancamentosCtx,
  id: string,
  body: PagarLancamentoBody,
): Promise<LancamentoDto> {
  const tdb = tdbDe(ctx);
  const atual = await repo.buscar(tdb, id);
  if (atual.status === 'pago') throw new ConflictError('Este lançamento já está pago');
  await repo.atualizar(tdb, id, {
    status: 'pago',
    dataPagamento: body.dataPagamento ?? ctx.hoje(),
    ...(body.formaPagamento ? { formaPagamento: body.formaPagamento } : {}),
  });
  return obterDto(tdb, id);
}

/** Vinculado a parcela (baixa) ou a DAS → 422: a exclusão é feita no módulo de origem. */
export async function excluir(ctx: LancamentosCtx, id: string): Promise<void> {
  const tdb = tdbDe(ctx);
  const atual = await repo.buscar(tdb, id);
  if (atual.parcelaId) {
    throw new UnprocessableError(
      'Este lançamento é a baixa de uma parcela. Estorne a baixa em Contas a pagar/receber.',
      [{ campo: 'parcelaId', mensagem: 'Lançamento vinculado a parcela' }],
    );
  }
  if (atual.origem === 'das') {
    throw new UnprocessableError(
      'Este lançamento é um pagamento de DAS. Desfaça o pagamento na tela do DAS.',
      [{ campo: 'origem', mensagem: 'Lançamento vinculado ao DAS' }],
    );
  }
  await excluirLancamentoInterno(ctx.exec, ctx.tenantId, id);
  if (atual.anexoPath) await ctx.storage.remover(atual.anexoPath).catch(() => undefined);
}

export async function resumo(
  ctx: LancamentosCtx,
  query: ResumoLancamentosQuery,
): Promise<ResumoLancamentosDto> {
  const linhas = await repo.resumo(tdbDe(ctx), query.de, query.ate);
  const grupo = () => ({ pagos: 0, pendentes: 0, total: 0, quantidade: 0 });
  const receitas = grupo();
  const despesas = grupo();
  for (const l of linhas) {
    const alvo = l.tipo === 'receita' ? receitas : despesas;
    if (l.status === 'pago') alvo.pagos += l.total;
    else alvo.pendentes += l.total;
    alvo.total += l.total;
    alvo.quantidade += l.quantidade;
  }
  return {
    periodo: { de: query.de, ate: query.ate },
    receitas,
    despesas,
    saldo: receitas.pagos - despesas.pagos,
    saldoPrevisto: receitas.total - despesas.total,
  };
}

// ---------------------------------------------------------------------------
// Anexo
// ---------------------------------------------------------------------------

export async function salvarAnexo(
  ctx: LancamentosCtx,
  id: string,
  arquivo: ArquivoEntrada,
): Promise<LancamentoDto> {
  const tdb = tdbDe(ctx);
  const atual = await repo.buscar(tdb, id);
  const meta = anexoUploadMeta.safeParse({
    nome: arquivo.nome,
    mime: arquivo.mime,
    tamanho: arquivo.conteudo.length,
  });
  if (!meta.success) {
    throw new ValidationError(
      'Anexo inválido',
      meta.error.issues.map((i) => ({ campo: 'arquivo', mensagem: i.message })),
    );
  }
  const salvo = await ctx.storage.salvar(ctx.tenantId, {
    nome: meta.data.nome,
    mime: meta.data.mime,
    conteudo: arquivo.conteudo,
  });
  await repo.atualizar(tdb, id, {
    anexoPath: salvo.path,
    anexoNome: salvo.nome,
    anexoMime: salvo.mime,
    anexoTamanho: salvo.tamanho,
  });
  if (atual.anexoPath && atual.anexoPath !== salvo.path) {
    await ctx.storage.remover(atual.anexoPath).catch(() => undefined);
  }
  return obterDto(tdb, id);
}

export interface AnexoLido {
  nome: string;
  mime: string;
  tamanho: number;
  conteudo: Buffer;
}

export async function lerAnexo(ctx: LancamentosCtx, id: string): Promise<AnexoLido> {
  const atual = await repo.buscar(tdbDe(ctx), id);
  if (!atual.anexoPath || !atual.anexoNome) throw new NotFoundError('Lançamento sem anexo');
  const conteudo = await ctx.storage.ler(atual.anexoPath);
  return {
    nome: atual.anexoNome,
    mime: atual.anexoMime ?? 'application/octet-stream',
    tamanho: conteudo.length,
    conteudo,
  };
}

export async function removerAnexo(ctx: LancamentosCtx, id: string): Promise<void> {
  const tdb = tdbDe(ctx);
  const atual = await repo.buscar(tdb, id);
  if (!atual.anexoPath) throw new NotFoundError('Lançamento sem anexo');
  await repo.atualizar(tdb, id, {
    anexoPath: null,
    anexoNome: null,
    anexoMime: null,
    anexoTamanho: null,
  });
  await ctx.storage.remover(atual.anexoPath).catch(() => undefined);
}
