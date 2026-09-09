// Regras de títulos (contas a pagar/receber) e parcelas: parcelamento (Σ parcelas = valor total),
// baixa (cria lançamento origem "baixa" via core), estorno, cancelamento e resumo.
// Lançamentos são criados/excluídos SOMENTE por modules/lancamentos/core.ts.
import {
  addDias,
  type AtualizarParcelaBody,
  type AtualizarTituloBody,
  type BaixaParcelaBody,
  type BaixaParcelaResponse,
  type CriarTituloBody,
  diasEntre,
  ehParcelasPorLista,
  gerarParcelas,
  type IsoDate,
  type LancamentoDto,
  type ListarParcelasQuery,
  type ListarTitulosQuery,
  type ListaParcelasResponse,
  type ListaTitulosResponse,
  type ParcelaComTituloDto,
  type ParcelaDto,
  type ResumoParcelasDto,
  type TituloDto,
  validarListaParcelas,
} from '@meifin/shared';

import type { DbExecutor } from '../../db/index.js';
import type { LancamentoRow } from '../../db/schema/lancamentos.js';
import type { ParcelaRow, TituloRow } from '../../db/schema/titulos.js';
import { NotFoundError, UnprocessableError } from '../../lib/errors.js';
import { isoTimestamp } from '../../lib/hoje.js';
import { forTenant, type TenantDb } from '../../lib/tenant-db.js';
import { criarLancamentoInterno, excluirLancamentoInterno } from '../lancamentos/core.js';
import * as repo from './repository.js';

// ---------------------------------------------------------------------------
// Mapeamento para DTOs
// ---------------------------------------------------------------------------

const ts = (v: string) => isoTimestamp(v) ?? v;

export function toParcelaDto(p: ParcelaRow, hoje: IsoDate): ParcelaDto {
  const atrasada = p.status === 'aberta' && p.vencimento < hoje;
  return {
    id: p.id,
    tituloId: p.tituloId,
    numero: p.numero,
    vencimento: p.vencimento,
    valor: p.valor,
    status: p.status,
    lancamentoId: p.lancamentoId,
    dataPagamento: p.dataPagamento,
    valorPago: p.valorPago,
    formaPagamento: p.formaPagamento,
    atrasada,
    diasAtraso: atrasada ? diasEntre(p.vencimento, hoje) : 0,
    createdAt: ts(p.createdAt),
    updatedAt: ts(p.updatedAt),
  };
}

function toParcelaComTituloDto(item: repo.ParcelaComTitulo, hoje: IsoDate): ParcelaComTituloDto {
  return {
    ...toParcelaDto(item.parcela, hoje),
    titulo: {
      id: item.titulo.id,
      tipo: item.titulo.tipo,
      descricao: item.titulo.descricao,
      contatoId: item.titulo.contatoId,
      contato: item.contato,
      categoriaId: item.titulo.categoriaId,
      numeroParcelas: item.titulo.numeroParcelas,
    },
  };
}

export function toTituloDto(
  item: repo.TituloComRefs,
  lista: ParcelaRow[],
  hoje: IsoDate,
): TituloDto {
  const t = item.titulo;
  const parcelas = lista.map((p) => toParcelaDto(p, hoje));
  const valorPago = lista
    .filter((p) => p.status === 'paga')
    .reduce((acc, p) => acc + (p.valorPago ?? p.valor), 0);
  const valorAberto = lista
    .filter((p) => p.status === 'aberta')
    .reduce((acc, p) => acc + p.valor, 0);
  return {
    id: t.id,
    tipo: t.tipo,
    descricao: t.descricao,
    contatoId: t.contatoId,
    contato: item.contato,
    categoriaId: t.categoriaId,
    categoria: item.categoria,
    valorTotal: t.valorTotal,
    numeroParcelas: t.numeroParcelas,
    dataEmissao: t.dataEmissao,
    notaFiscalId: t.notaFiscalId,
    status: t.status,
    observacoes: t.observacoes,
    valorPago,
    valorAberto,
    parcelas,
    createdAt: ts(t.createdAt),
    updatedAt: ts(t.updatedAt),
  };
}

function toLancamentoDto(
  l: LancamentoRow,
  categoria: repo.CategoriaRef | null,
  contato: repo.ContatoRef | null,
): LancamentoDto {
  return {
    id: l.id,
    tipo: l.tipo,
    data: l.data,
    valor: l.valor,
    descricao: l.descricao,
    categoriaId: l.categoriaId,
    categoria,
    contatoId: l.contatoId,
    contato,
    formaPagamento: l.formaPagamento,
    status: l.status,
    dataPagamento: l.dataPagamento,
    observacoes: l.observacoes,
    anexo:
      l.anexoPath && l.anexoNome && l.anexoMime
        ? { nome: l.anexoNome, mime: l.anexoMime, tamanho: l.anexoTamanho ?? 0 }
        : null,
    origem: l.origem,
    recorrenciaId: l.recorrenciaId,
    competencia: l.competencia ? l.competencia.slice(0, 7) : null,
    parcelaId: l.parcelaId,
    importacaoId: l.importacaoId,
    createdAt: ts(l.createdAt),
    updatedAt: ts(l.updatedAt),
  };
}

// ---------------------------------------------------------------------------
// Validações de referências
// ---------------------------------------------------------------------------

const TIPO_LANCAMENTO_POR_TITULO = { pagar: 'despesa', receber: 'receita' } as const;

async function validarCategoria(tdb: TenantDb, categoriaId: string, tipo: TituloRow['tipo']) {
  const categoria = await repo.buscarCategoria(tdb, categoriaId);
  if (!categoria) throw new NotFoundError('Categoria não encontrada');
  const esperado = TIPO_LANCAMENTO_POR_TITULO[tipo];
  if (categoria.tipo !== esperado) {
    throw new UnprocessableError(
      `Conta a ${tipo} exige uma categoria de ${esperado}; "${categoria.nome}" é de ${categoria.tipo}`,
      [{ campo: 'categoriaId', mensagem: `Escolha uma categoria de ${esperado}` }],
    );
  }
  return categoria;
}

async function validarContato(tdb: TenantDb, contatoId: string | null | undefined) {
  if (!contatoId) return null;
  const contato = await repo.buscarContato(tdb, contatoId);
  if (!contato) throw new NotFoundError('Contato não encontrado');
  return contato;
}

async function validarNotaFiscal(tdb: TenantDb, notaFiscalId: string | null | undefined) {
  if (!notaFiscalId) return null;
  const nota = await repo.buscarNotaFiscal(tdb, notaFiscalId);
  if (!nota) throw new NotFoundError('Nota fiscal não encontrada');
  return nota;
}

async function obterTituloOu404(tdb: TenantDb, id: string): Promise<repo.TituloComRefs> {
  const item = await repo.buscarTitulo(tdb, id);
  if (!item) throw new NotFoundError('Conta não encontrada');
  return item;
}

async function obterParcelaOu404(tdb: TenantDb, id: string): Promise<repo.ParcelaComTitulo> {
  const item = await repo.buscarParcela(tdb, id);
  if (!item) throw new NotFoundError('Parcela não encontrada');
  return item;
}

// ---------------------------------------------------------------------------
// Títulos
// ---------------------------------------------------------------------------

export async function listarTitulos(
  tdb: TenantDb,
  query: ListarTitulosQuery,
  hoje: IsoDate,
): Promise<ListaTitulosResponse> {
  const { itens, total } = await repo.listarTitulos(tdb, query);
  const parcelasPorTitulo = await repo.listarParcelasDosTitulos(
    tdb,
    itens.map((i) => i.titulo.id),
  );
  return {
    data: itens.map((i) => toTituloDto(i, parcelasPorTitulo.get(i.titulo.id) ?? [], hoje)),
    meta: { page: query.page, pageSize: query.pageSize, total },
  };
}

export async function obterTitulo(tdb: TenantDb, id: string, hoje: IsoDate): Promise<TituloDto> {
  const item = await obterTituloOu404(tdb, id);
  return toTituloDto(item, await repo.listarParcelasDoTitulo(tdb, id), hoje);
}

/** Cria o título e as parcelas na mesma transação. Σ parcelas = valorTotal sempre. */
export async function criarTitulo(
  tx: DbExecutor,
  tenantId: string,
  body: CriarTituloBody,
  hoje: IsoDate,
): Promise<TituloDto> {
  const tdb = forTenant(tx, tenantId);
  await validarCategoria(tdb, body.categoriaId, body.tipo);
  await validarContato(tdb, body.contatoId);
  await validarNotaFiscal(tdb, body.notaFiscalId);

  const geradas = ehParcelasPorLista(body.parcelas)
    ? body.parcelas.lista.map((p, i) => ({
        numero: i + 1,
        vencimento: p.vencimento,
        valor: p.valor,
      }))
    : gerarParcelas(body.valorTotal, body.parcelas.quantidade, body.parcelas.primeiroVencimento);

  if (!validarListaParcelas(geradas, body.valorTotal)) {
    throw new UnprocessableError('A soma das parcelas deve ser igual ao valor total', [
      { campo: 'parcelas', mensagem: 'A soma das parcelas deve ser igual ao valor total' },
    ]);
  }

  const titulo = await repo.criarTitulo(tdb, {
    tipo: body.tipo,
    descricao: body.descricao,
    contatoId: body.contatoId ?? null,
    categoriaId: body.categoriaId,
    valorTotal: body.valorTotal,
    numeroParcelas: geradas.length,
    dataEmissao: body.dataEmissao ?? hoje,
    notaFiscalId: body.notaFiscalId ?? null,
    status: 'aberto',
    observacoes: body.observacoes ?? null,
  });
  const criadas = await repo.criarParcelas(
    tdb,
    geradas.map((p) => ({
      tituloId: titulo.id,
      numero: p.numero,
      vencimento: p.vencimento,
      valor: p.valor,
      status: 'aberta' as const,
    })),
  );
  const item = await obterTituloOu404(tdb, titulo.id);
  return toTituloDto(item, criadas, hoje);
}

export async function atualizarTitulo(
  tx: DbExecutor,
  tenantId: string,
  id: string,
  body: AtualizarTituloBody,
  hoje: IsoDate,
): Promise<TituloDto> {
  const tdb = forTenant(tx, tenantId);
  const atual = await obterTituloOu404(tdb, id);
  if (atual.titulo.status === 'cancelado') {
    throw new UnprocessableError('Conta cancelada não pode ser alterada');
  }
  if (body.categoriaId !== undefined) {
    await validarCategoria(tdb, body.categoriaId, atual.titulo.tipo);
  }
  if (body.contatoId !== undefined) await validarContato(tdb, body.contatoId);
  if (body.notaFiscalId !== undefined) await validarNotaFiscal(tdb, body.notaFiscalId);

  const valores = {
    ...(body.descricao !== undefined ? { descricao: body.descricao } : {}),
    ...(body.contatoId !== undefined ? { contatoId: body.contatoId } : {}),
    ...(body.categoriaId !== undefined ? { categoriaId: body.categoriaId } : {}),
    ...(body.dataEmissao !== undefined ? { dataEmissao: body.dataEmissao } : {}),
    ...(body.notaFiscalId !== undefined ? { notaFiscalId: body.notaFiscalId } : {}),
    ...(body.observacoes !== undefined ? { observacoes: body.observacoes } : {}),
  };
  if (Object.keys(valores).length > 0) await repo.atualizarTitulo(tdb, id, valores);
  if (body.status === 'cancelado') await cancelarTituloInterno(tdb, id);

  return toTituloDto(
    await obterTituloOu404(tdb, id),
    await repo.listarParcelasDoTitulo(tdb, id),
    hoje,
  );
}

async function cancelarTituloInterno(tdb: TenantDb, id: string): Promise<void> {
  const parcelas = await repo.listarParcelasDoTitulo(tdb, id);
  if (parcelas.some((p) => p.status === 'paga')) {
    throw new UnprocessableError(
      'Não é possível cancelar uma conta com parcelas pagas. Estorne as parcelas antes.',
    );
  }
  await repo.cancelarParcelasAbertas(tdb, id);
  await repo.atualizarTitulo(tdb, id, { status: 'cancelado' });
}

/** DELETE /titulos/:id = cancelamento (422 se houver parcela paga). */
export async function cancelarTitulo(
  tx: DbExecutor,
  tenantId: string,
  id: string,
  hoje: IsoDate,
): Promise<TituloDto> {
  const tdb = forTenant(tx, tenantId);
  const atual = await obterTituloOu404(tdb, id);
  if (atual.titulo.status !== 'cancelado') await cancelarTituloInterno(tdb, id);
  return toTituloDto(
    await obterTituloOu404(tdb, id),
    await repo.listarParcelasDoTitulo(tdb, id),
    hoje,
  );
}

// ---------------------------------------------------------------------------
// Parcelas
// ---------------------------------------------------------------------------

export async function listarParcelas(
  tdb: TenantDb,
  query: ListarParcelasQuery,
  hoje: IsoDate,
): Promise<ListaParcelasResponse> {
  const r = await repo.listarParcelas(tdb, query, hoje);
  return {
    data: r.itens.map((i) => toParcelaComTituloDto(i, hoje)),
    meta: { page: query.page, pageSize: query.pageSize, total: r.total },
    totais: { valor: r.totalValor, atrasado: r.totalAtrasado },
  };
}

export async function obterParcela(
  tdb: TenantDb,
  id: string,
  hoje: IsoDate,
): Promise<ParcelaComTituloDto> {
  return toParcelaComTituloDto(await obterParcelaOu404(tdb, id), hoje);
}

/** PATCH /parcelas/:id: só abertas. Alterar o valor recalcula o valor total do título. */
export async function atualizarParcela(
  tx: DbExecutor,
  tenantId: string,
  id: string,
  body: AtualizarParcelaBody,
  hoje: IsoDate,
): Promise<ParcelaComTituloDto> {
  const tdb = forTenant(tx, tenantId);
  const atual = await obterParcelaOu404(tdb, id);
  if (atual.parcela.status !== 'aberta') {
    throw new UnprocessableError('Só parcelas em aberto podem ser alteradas');
  }
  await repo.atualizarParcela(tdb, id, {
    ...(body.vencimento !== undefined ? { vencimento: body.vencimento } : {}),
    ...(body.valor !== undefined ? { valor: body.valor } : {}),
  });
  if (body.valor !== undefined && body.valor !== atual.parcela.valor) {
    const todas = await repo.listarParcelasDoTitulo(tdb, atual.titulo.id);
    const total = todas
      .filter((p) => p.status !== 'cancelada')
      .reduce((acc, p) => acc + p.valor, 0);
    await repo.atualizarTitulo(tdb, atual.titulo.id, { valorTotal: total });
  }
  return toParcelaComTituloDto(await obterParcelaOu404(tdb, id), hoje);
}

/** Baixa: cria lançamento (origem baixa) via core, marca a parcela paga e quita o título se for a última. */
export async function baixarParcela(
  tx: DbExecutor,
  tenantId: string,
  id: string,
  body: BaixaParcelaBody,
  hoje: IsoDate,
): Promise<BaixaParcelaResponse['data']> {
  const tdb = forTenant(tx, tenantId);
  const atual = await obterParcelaOu404(tdb, id);
  if (atual.parcela.status !== 'aberta') {
    throw new UnprocessableError(
      atual.parcela.status === 'paga'
        ? 'Esta parcela já foi paga'
        : 'Parcela cancelada não pode ser baixada',
    );
  }
  if (atual.titulo.status === 'cancelado') {
    throw new UnprocessableError('Conta cancelada não aceita baixa');
  }

  const dataPagamento = body.dataPagamento ?? hoje;
  const valorPago = body.valorPago ?? atual.parcela.valor;
  const formaPagamento = body.formaPagamento ?? 'pix';
  const sufixo =
    atual.titulo.numeroParcelas > 1
      ? ` (${atual.parcela.numero}/${atual.titulo.numeroParcelas})`
      : '';

  const lancamento = await criarLancamentoInterno(tx, tenantId, {
    tipo: TIPO_LANCAMENTO_POR_TITULO[atual.titulo.tipo],
    data: dataPagamento,
    valor: valorPago,
    descricao: `${atual.titulo.descricao}${sufixo}`,
    categoriaId: atual.titulo.categoriaId,
    contatoId: atual.titulo.contatoId,
    formaPagamento,
    status: 'pago',
    dataPagamento,
    origem: 'baixa',
    parcelaId: atual.parcela.id,
    observacoes: body.observacoes ?? null,
  });

  await repo.atualizarParcela(tdb, id, {
    status: 'paga',
    lancamentoId: lancamento.id,
    dataPagamento,
    valorPago,
    formaPagamento,
  });

  const todas = await repo.listarParcelasDoTitulo(tdb, atual.titulo.id);
  const quitado = todas.every((p) => p.status !== 'aberta');
  if (quitado && atual.titulo.status !== 'quitado') {
    await repo.atualizarTitulo(tdb, atual.titulo.id, { status: 'quitado' });
  }

  const tituloAtual = await obterTituloOu404(tdb, atual.titulo.id);
  return {
    parcela: toParcelaComTituloDto(await obterParcelaOu404(tdb, id), hoje),
    lancamento: toLancamentoDto(lancamento, tituloAtual.categoria, tituloAtual.contato),
    titulo: toTituloDto(tituloAtual, todas, hoje),
  };
}

/** Estorno: exclui (soft) o lançamento via core, reabre a parcela e volta o título para aberto. */
export async function estornarParcela(
  tx: DbExecutor,
  tenantId: string,
  id: string,
  hoje: IsoDate,
): Promise<ParcelaComTituloDto> {
  const tdb = forTenant(tx, tenantId);
  const atual = await obterParcelaOu404(tdb, id);
  if (atual.parcela.status !== 'paga') {
    throw new UnprocessableError('Só parcelas pagas podem ser estornadas');
  }
  if (atual.parcela.lancamentoId) {
    const lancamento = await repo.buscarLancamento(tdb, atual.parcela.lancamentoId);
    if (lancamento) await excluirLancamentoInterno(tx, tenantId, lancamento.id);
  }
  await repo.atualizarParcela(tdb, id, {
    status: 'aberta',
    lancamentoId: null,
    dataPagamento: null,
    valorPago: null,
    formaPagamento: null,
  });
  if (atual.titulo.status === 'quitado') {
    await repo.atualizarTitulo(tdb, atual.titulo.id, { status: 'aberto' });
  }
  return toParcelaComTituloDto(await obterParcelaOu404(tdb, id), hoje);
}

export async function resumo(
  tdb: TenantDb,
  dias: number,
  hoje: IsoDate,
): Promise<ResumoParcelasDto> {
  const limite = addDias(hoje, dias);
  const inicio = addDias(hoje, -dias);
  const pagar = await repo.resumoParcelas(tdb, 'pagar', hoje, limite, inicio);
  const receber = await repo.resumoParcelas(tdb, 'receber', hoje, limite, inicio);
  return { dias, pagar, receber };
}
