// Regras de notas fiscais: número único por (tipo, série), receita gerada via core
// (origem nota_fiscal), vínculo com lançamento existente, cancelamento (com estorno opcional),
// arquivo (PDF/XML/imagem) no storage e resumo anual.
import {
  type AnexoDto,
  anexoUploadMeta,
  type AtualizarNotaFiscalBody,
  type CancelarNotaFiscalBody,
  type CriarNotaFiscalBody,
  type CriarNotaFiscalResponse,
  fimAno,
  inicioAno,
  type IsoDate,
  type LancamentoDto,
  type ListaNotasFiscaisResponse,
  type ListarNotasFiscaisQuery,
  type NotaFiscalDto,
  type ResumoNotasFiscaisDto,
  TIPOS_NOTA,
} from '@meifin/shared';

import type { DbExecutor } from '../../db/index.js';
import type { LancamentoRow } from '../../db/schema/lancamentos.js';
import type { NotaFiscalRow } from '../../db/schema/notas-fiscais.js';
import {
  ConflictError,
  NotFoundError,
  UnprocessableError,
  ValidationError,
} from '../../lib/errors.js';
import { isoTimestamp } from '../../lib/hoje.js';
import type { ArquivoEntrada, FileStorage } from '../../lib/storage.js';
import { forTenant, type TenantDb } from '../../lib/tenant-db.js';
import { criarLancamentoInterno, excluirLancamentoInterno } from '../lancamentos/core.js';
import { obterProvider } from './providers/index.js';
import * as repo from './repository.js';

const SERIE_PADRAO = '1';
const CHAVE_TAMANHO = 'arquivoTamanho';

const ts = (v: string) => isoTimestamp(v) ?? v;

const LABEL_TIPO: Record<NotaFiscalRow['tipo'], string> = {
  nfe: 'NF-e',
  nfse: 'NFS-e',
  nfce: 'NFC-e',
};

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

function arquivoDe(n: NotaFiscalRow): AnexoDto | null {
  if (!n.arquivoPath || !n.arquivoNome || !n.arquivoMime) return null;
  const tamanho = n.provedorPayload?.[CHAVE_TAMANHO];
  return {
    nome: n.arquivoNome,
    mime: n.arquivoMime,
    tamanho: typeof tamanho === 'number' ? tamanho : 0,
  };
}

export function toNotaDto(item: repo.NotaComRefs): NotaFiscalDto {
  const n = item.nota;
  return {
    id: n.id,
    tipo: n.tipo,
    numero: n.numero,
    serie: n.serie,
    dataEmissao: n.dataEmissao,
    contatoId: n.contatoId,
    contato: item.contato,
    valor: n.valor,
    descricao: n.descricao,
    status: n.status,
    dataCancelamento: n.dataCancelamento,
    motivoCancelamento: n.motivoCancelamento,
    lancamentoId: n.lancamentoId,
    linkExterno: n.linkExterno,
    arquivo: arquivoDe(n),
    provedor: n.provedor,
    chaveAcesso: n.chaveAcesso,
    protocolo: n.protocolo,
    createdAt: ts(n.createdAt),
    updatedAt: ts(n.updatedAt),
  };
}

async function toLancamentoDto(tdb: TenantDb, l: LancamentoRow): Promise<LancamentoDto> {
  const refs = await repo.buscarRefsDoLancamento(tdb, l);
  return {
    id: l.id,
    tipo: l.tipo,
    data: l.data,
    valor: l.valor,
    descricao: l.descricao,
    categoriaId: l.categoriaId,
    categoria: refs.categoria,
    contatoId: l.contatoId,
    contato: refs.contato,
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
// Validações
// ---------------------------------------------------------------------------

async function obterOu404(tdb: TenantDb, id: string): Promise<repo.NotaComRefs> {
  const item = await repo.buscar(tdb, id);
  if (!item) throw new NotFoundError('Nota fiscal não encontrada');
  return item;
}

async function garantirNumeroUnico(
  tdb: TenantDb,
  tipo: NotaFiscalRow['tipo'],
  serie: string,
  numero: string,
  ignorarId?: string,
) {
  const duplicada = await repo.buscarDuplicada(tdb, tipo, serie, numero, ignorarId);
  if (duplicada) {
    throw new ConflictError(`Já existe uma ${LABEL_TIPO[tipo]} nº ${numero} (série ${serie})`, [
      { campo: 'numero', mensagem: 'Já existe uma nota com esse número e série' },
    ]);
  }
}

async function validarContato(tdb: TenantDb, contatoId: string | null | undefined) {
  if (!contatoId) return null;
  const contato = await repo.buscarContato(tdb, contatoId);
  if (!contato) throw new NotFoundError('Contato não encontrado');
  return contato;
}

/** Lançamento a vincular: existe no tenant, é receita e não pertence a outra nota. */
async function validarLancamentoParaVinculo(
  tdb: TenantDb,
  lancamentoId: string,
  ignorarNotaId?: string,
): Promise<LancamentoRow> {
  const lancamento = await repo.buscarLancamento(tdb, lancamentoId);
  if (!lancamento) throw new NotFoundError('Lançamento não encontrado');
  if (lancamento.tipo !== 'receita') {
    throw new UnprocessableError('Só é possível vincular uma receita à nota fiscal', [
      { campo: 'lancamentoId', mensagem: 'O lançamento precisa ser uma receita' },
    ]);
  }
  const outra = await repo.buscarPorLancamento(tdb, lancamentoId, ignorarNotaId);
  if (outra) {
    throw new ConflictError(
      `Este lançamento já está vinculado à ${LABEL_TIPO[outra.tipo]} nº ${outra.numero}`,
      [{ campo: 'lancamentoId', mensagem: 'Lançamento já vinculado a outra nota' }],
    );
  }
  return lancamento;
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export async function listar(
  tdb: TenantDb,
  query: ListarNotasFiscaisQuery,
): Promise<ListaNotasFiscaisResponse> {
  const r = await repo.listar(tdb, query);
  return {
    data: r.itens.map(toNotaDto),
    meta: { page: query.page, pageSize: query.pageSize, total: r.total },
    totais: { valor: r.totalValor, quantidade: r.total },
  };
}

export async function obter(tdb: TenantDb, id: string): Promise<NotaFiscalDto> {
  return toNotaDto(await obterOu404(tdb, id));
}

export async function resumo(tdb: TenantDb, ano: number): Promise<ResumoNotasFiscaisDto> {
  const r = await repo.resumo(tdb, inicioAno(ano), fimAno(ano));
  const porTipoMapa = new Map(r.porTipo.map((t) => [t.tipo, t]));
  const porMesMapa = new Map(r.porMes.map((m) => [m.mes, m]));
  return {
    ano,
    emitidas: r.emitidas,
    canceladas: r.canceladas,
    semLancamento: r.semLancamento,
    porTipo: TIPOS_NOTA.map((tipo) => ({
      tipo,
      quantidade: porTipoMapa.get(tipo)?.quantidade ?? 0,
      valor: porTipoMapa.get(tipo)?.valor ?? 0,
    })),
    porMes: Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      return {
        competencia: `${ano}-${String(mes).padStart(2, '0')}`,
        quantidade: porMesMapa.get(mes)?.quantidade ?? 0,
        valor: porMesMapa.get(mes)?.valor ?? 0,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

export async function criar(
  tx: DbExecutor,
  tenantId: string,
  body: CriarNotaFiscalBody,
): Promise<CriarNotaFiscalResponse['data']> {
  const tdb = forTenant(tx, tenantId);
  const serie = body.serie?.trim() || SERIE_PADRAO;
  await garantirNumeroUnico(tdb, body.tipo, serie, body.numero);
  const contato = await validarContato(tdb, body.contatoId);

  let lancamento: LancamentoRow | null = null;
  if (body.lancamentoId) {
    lancamento = await validarLancamentoParaVinculo(tdb, body.lancamentoId);
  }

  const provider = obterProvider('manual');
  const emissao = await provider.emitir({
    tipo: body.tipo,
    numero: body.numero,
    serie,
    dataEmissao: body.dataEmissao,
    valor: body.valor,
    descricao: body.descricao ?? null,
    chaveAcesso: body.chaveAcesso ?? null,
    contato: contato ? { nome: contato.nome, documento: contato.documento } : null,
  });

  const nota = await repo.criar(tdb, {
    tipo: body.tipo,
    numero: body.numero,
    serie,
    dataEmissao: body.dataEmissao,
    contatoId: body.contatoId ?? null,
    valor: body.valor,
    descricao: body.descricao ?? null,
    status: 'emitida',
    lancamentoId: lancamento?.id ?? null,
    linkExterno: body.linkExterno ?? null,
    provedor: emissao.provedor,
    chaveAcesso: emissao.chaveAcesso,
    protocolo: emissao.protocolo,
    ambiente: emissao.ambiente,
    xmlPath: emissao.xmlPath,
    provedorPayload: emissao.payload,
  });

  if (body.gerarReceita) {
    // categoriaId garantido pelo superRefine do schema; core valida tipo receita (422) e tenant (404).
    lancamento = await criarLancamentoInterno(tx, tenantId, {
      tipo: 'receita',
      data: body.dataEmissao,
      valor: body.valor,
      descricao: body.descricao?.trim() || `${LABEL_TIPO[body.tipo]} nº ${body.numero}`,
      categoriaId: body.categoriaId!,
      contatoId: body.contatoId ?? null,
      formaPagamento: 'pix',
      status: 'pago',
      dataPagamento: body.dataEmissao,
      origem: 'nota_fiscal',
    });
    await repo.atualizar(tdb, nota.id, { lancamentoId: lancamento.id });
  }

  return {
    nota: toNotaDto(await obterOu404(tdb, nota.id)),
    lancamento: lancamento ? await toLancamentoDto(tdb, lancamento) : null,
  };
}

export async function atualizar(
  tx: DbExecutor,
  tenantId: string,
  id: string,
  body: AtualizarNotaFiscalBody,
): Promise<NotaFiscalDto> {
  const tdb = forTenant(tx, tenantId);
  const atual = (await obterOu404(tdb, id)).nota;
  if (atual.status === 'cancelada') {
    throw new UnprocessableError('Nota cancelada não pode ser alterada');
  }
  const tipo = body.tipo ?? atual.tipo;
  const serie = body.serie === undefined ? atual.serie : body.serie?.trim() || SERIE_PADRAO;
  const numero = body.numero ?? atual.numero;
  if (tipo !== atual.tipo || serie !== atual.serie || numero !== atual.numero) {
    await garantirNumeroUnico(tdb, tipo, serie, numero, id);
  }
  if (body.contatoId !== undefined) await validarContato(tdb, body.contatoId);

  await repo.atualizar(tdb, id, {
    ...(body.tipo !== undefined ? { tipo: body.tipo } : {}),
    ...(body.numero !== undefined ? { numero: body.numero } : {}),
    ...(body.serie !== undefined ? { serie } : {}),
    ...(body.dataEmissao !== undefined ? { dataEmissao: body.dataEmissao } : {}),
    ...(body.contatoId !== undefined ? { contatoId: body.contatoId } : {}),
    ...(body.valor !== undefined ? { valor: body.valor } : {}),
    ...(body.descricao !== undefined ? { descricao: body.descricao } : {}),
    ...(body.linkExterno !== undefined ? { linkExterno: body.linkExterno } : {}),
    ...(body.chaveAcesso !== undefined ? { chaveAcesso: body.chaveAcesso } : {}),
  });
  return toNotaDto(await obterOu404(tdb, id));
}

export interface CancelamentoResultado {
  nota: NotaFiscalDto;
  /** Receita que estava vinculada (null se não havia); `excluido` = true quando estornada. */
  lancamentoVinculado: { id: string; excluido: boolean } | null;
}

export async function cancelar(
  tx: DbExecutor,
  tenantId: string,
  id: string,
  body: CancelarNotaFiscalBody,
  hoje: IsoDate,
): Promise<CancelamentoResultado> {
  const tdb = forTenant(tx, tenantId);
  const atual = (await obterOu404(tdb, id)).nota;
  if (atual.status === 'cancelada') {
    throw new UnprocessableError('Esta nota já está cancelada');
  }
  const provider = obterProvider(atual.provedor);
  const resultado = await provider.cancelar(
    { chaveAcesso: atual.chaveAcesso, protocolo: atual.protocolo },
    body.motivoCancelamento,
  );

  let lancamentoVinculado: CancelamentoResultado['lancamentoVinculado'] = null;
  if (atual.lancamentoId) {
    const lancamento = await repo.buscarLancamento(tdb, atual.lancamentoId);
    if (lancamento && body.estornarReceita) {
      await excluirLancamentoInterno(tx, tenantId, lancamento.id);
      lancamentoVinculado = { id: lancamento.id, excluido: true };
    } else if (lancamento) {
      lancamentoVinculado = { id: lancamento.id, excluido: false };
    }
  }

  await repo.atualizar(tdb, id, {
    status: 'cancelada',
    dataCancelamento: body.dataCancelamento ?? hoje,
    motivoCancelamento: body.motivoCancelamento,
    ...(lancamentoVinculado?.excluido ? { lancamentoId: null } : {}),
    ...(resultado.protocolo ? { protocolo: resultado.protocolo } : {}),
  });
  return { nota: toNotaDto(await obterOu404(tdb, id)), lancamentoVinculado };
}

export async function vincular(
  tx: DbExecutor,
  tenantId: string,
  id: string,
  lancamentoId: string | null,
): Promise<NotaFiscalDto> {
  const tdb = forTenant(tx, tenantId);
  await obterOu404(tdb, id);
  if (lancamentoId) await validarLancamentoParaVinculo(tdb, lancamentoId, id);
  await repo.atualizar(tdb, id, { lancamentoId });
  return toNotaDto(await obterOu404(tdb, id));
}

/** Soft delete. A receita vinculada (se houver) é mantida; só o vínculo se perde. */
export async function excluir(tdb: TenantDb, id: string, storage: FileStorage): Promise<void> {
  const atual = (await obterOu404(tdb, id)).nota;
  await repo.excluir(tdb, id);
  if (atual.arquivoPath) await storage.remover(atual.arquivoPath).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Arquivo (PDF/XML/imagem da nota)
// ---------------------------------------------------------------------------

export async function salvarArquivo(
  tdb: TenantDb,
  id: string,
  storage: FileStorage,
  arquivo: ArquivoEntrada,
): Promise<AnexoDto> {
  const atual = (await obterOu404(tdb, id)).nota;
  const meta = anexoUploadMeta.safeParse({
    nome: arquivo.nome,
    mime: arquivo.mime,
    tamanho: arquivo.conteudo.length,
  });
  if (!meta.success) {
    throw new ValidationError(
      'Arquivo inválido',
      meta.error.issues.map((i) => ({
        campo: String(i.path[0] ?? 'arquivo'),
        mensagem: i.message,
      })),
    );
  }
  const salvo = await storage.salvar(tdb.tenantId, arquivo);
  await repo.atualizar(tdb, id, {
    arquivoPath: salvo.path,
    arquivoNome: salvo.nome,
    arquivoMime: salvo.mime,
    provedorPayload: { ...(atual.provedorPayload ?? {}), [CHAVE_TAMANHO]: salvo.tamanho },
  });
  if (atual.arquivoPath && atual.arquivoPath !== salvo.path) {
    await storage.remover(atual.arquivoPath).catch(() => undefined);
  }
  return { nome: salvo.nome, mime: salvo.mime, tamanho: salvo.tamanho };
}

export async function lerArquivo(
  tdb: TenantDb,
  id: string,
  storage: FileStorage,
): Promise<{ conteudo: Buffer; nome: string; mime: string }> {
  const atual = (await obterOu404(tdb, id)).nota;
  if (!atual.arquivoPath || !atual.arquivoNome || !atual.arquivoMime) {
    throw new NotFoundError('Esta nota não tem arquivo anexado');
  }
  return {
    conteudo: await storage.ler(atual.arquivoPath),
    nome: atual.arquivoNome,
    mime: atual.arquivoMime,
  };
}

export async function removerArquivo(
  tdb: TenantDb,
  id: string,
  storage: FileStorage,
): Promise<void> {
  const atual = (await obterOu404(tdb, id)).nota;
  if (!atual.arquivoPath) throw new NotFoundError('Esta nota não tem arquivo anexado');
  await storage.remover(atual.arquivoPath).catch(() => undefined);
  const payload = { ...(atual.provedorPayload ?? {}) };
  delete payload[CHAVE_TAMANHO];
  await repo.atualizar(tdb, id, {
    arquivoPath: null,
    arquivoNome: null,
    arquivoMime: null,
    provedorPayload: Object.keys(payload).length > 0 ? payload : null,
  });
}
