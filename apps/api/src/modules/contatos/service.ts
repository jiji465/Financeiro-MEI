// Regras de contatos: documento (CPF/CNPJ) validado e normalizado, único por tenant (409 campo
// "documento"), soft delete sempre permitido (lançamentos continuam apontando para o contato),
// histórico e resumo financeiro calculados a partir de lançamentos, parcelas e notas.
// Contratos: @meifin/shared/schemas/contatos.
import {
  type AtualizarContatoBody,
  type ContatoDto,
  type ContatoLancamentosQuery,
  type ContatoOpcaoDto,
  type ContatoResumoDto,
  type CriarContatoBody,
  type Endereco,
  type LancamentoDto,
  type ListaContatosResponse,
  type ListaLancamentosResponse,
  type ListarContatosQuery,
  type OpcoesContatosQuery,
  normalizarDocumento,
  tipoDocumento,
} from '@meifin/shared';

import type { ContatoRow } from '../../db/schema/contatos.js';
import { ConflictError, ValidationError } from '../../lib/errors.js';
import { isoTimestamp } from '../../lib/hoje.js';
import { paginado, parsePaginacao } from '../../lib/pagination.js';
import type { TenantDb } from '../../lib/tenant-db.js';
import * as repo from './repository.js';

export function toContatoDto(row: ContatoRow): ContatoDto {
  return {
    id: row.id,
    tipo: row.tipo,
    nome: row.nome,
    documento: row.documento,
    tipoDocumento: row.tipoDocumento ?? null,
    email: row.email,
    telefone: row.telefone,
    endereco: {
      logradouro: row.logradouro,
      numero: row.numero,
      complemento: row.complemento,
      bairro: row.bairro,
      cidade: row.cidade,
      uf: row.uf,
      cep: row.cep,
    },
    observacoes: row.observacoes,
    ativo: row.ativo,
    createdAt: isoTimestamp(row.createdAt) ?? row.createdAt,
    updatedAt: isoTimestamp(row.updatedAt) ?? row.updatedAt,
  };
}

export function toContatoOpcaoDto(
  row: Pick<ContatoRow, 'id' | 'nome' | 'tipo' | 'documento'>,
): ContatoOpcaoDto {
  return { id: row.id, nome: row.nome, tipo: row.tipo, documento: row.documento };
}

function toLancamentoDto(linha: repo.LinhaHistorico, contato: ContatoRow): LancamentoDto {
  const l = linha.lancamento;
  return {
    id: l.id,
    tipo: l.tipo,
    data: l.data,
    valor: l.valor,
    descricao: l.descricao,
    categoriaId: l.categoriaId,
    categoria: linha.categoria,
    contatoId: l.contatoId,
    contato: { id: contato.id, nome: contato.nome, tipo: contato.tipo },
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
    createdAt: isoTimestamp(l.createdAt) ?? l.createdAt,
    updatedAt: isoTimestamp(l.updatedAt) ?? l.updatedAt,
  };
}

/** Documento normalizado (14 chars maiúsculos) + tipo; inválido → 400 campo "documento". */
function resolverDocumento(bruto: string | null | undefined): {
  documento: string | null;
  tipoDocumento: 'cpf' | 'cnpj' | null;
} {
  if (bruto === undefined || bruto === null || bruto.trim() === '') {
    return { documento: null, tipoDocumento: null };
  }
  const documento = normalizarDocumento(bruto);
  const tipo = tipoDocumento(documento);
  if (!tipo) {
    const rotulo = documento.length === 11 ? 'CPF' : 'CNPJ';
    throw new ValidationError(`${rotulo} inválido`, [
      { campo: 'documento', mensagem: `${rotulo} inválido: confira os dígitos` },
    ]);
  }
  return { documento, tipoDocumento: tipo };
}

async function garantirDocumentoUnico(tdb: TenantDb, documento: string, ignorarId?: string) {
  const existente = await repo.buscarPorDocumento(tdb, documento);
  if (existente && existente.id !== ignorarId) {
    throw new ConflictError(`Já existe um contato com esse documento: ${existente.nome}`, [
      { campo: 'documento', mensagem: `Já cadastrado para "${existente.nome}"` },
    ]);
  }
}

function colunasEndereco(endereco: Endereco | undefined) {
  if (endereco === undefined) return {};
  return {
    logradouro: endereco.logradouro || null,
    numero: endereco.numero || null,
    complemento: endereco.complemento || null,
    bairro: endereco.bairro || null,
    cidade: endereco.cidade || null,
    uf: endereco.uf ?? null,
    cep: endereco.cep ?? null,
  };
}

export async function listar(
  tdb: TenantDb,
  query: ListarContatosQuery,
): Promise<ListaContatosResponse> {
  const paginacao = parsePaginacao(query);
  const { linhas, total } = await repo.listar(
    tdb,
    {
      tipo: query.tipo,
      ativo: query.ativo,
      busca: query.busca || undefined,
      ordenarPor: query.ordenarPor,
      ordem: query.ordem,
    },
    paginacao,
  );
  return paginado(linhas.map(toContatoDto), total, paginacao.page, paginacao.pageSize);
}

export async function opcoes(
  tdb: TenantDb,
  query: OpcoesContatosQuery,
): Promise<ContatoOpcaoDto[]> {
  const linhas = await repo.opcoes(tdb, { tipo: query.tipo, busca: query.busca || undefined });
  return linhas.map(toContatoOpcaoDto);
}

export async function obter(tdb: TenantDb, id: string): Promise<ContatoDto> {
  return toContatoDto(await repo.buscar(tdb, id));
}

export async function criar(tdb: TenantDb, body: CriarContatoBody): Promise<ContatoDto> {
  const doc = resolverDocumento(body.documento);
  if (doc.documento) await garantirDocumentoUnico(tdb, doc.documento);
  const criado = await repo.criar(tdb, {
    tipo: body.tipo,
    nome: body.nome,
    documento: doc.documento,
    tipoDocumento: doc.tipoDocumento,
    email: body.email ?? null,
    telefone: body.telefone ?? null,
    observacoes: body.observacoes ?? null,
    ativo: true,
    ...colunasEndereco(body.endereco),
  });
  return toContatoDto(criado);
}

export async function atualizar(
  tdb: TenantDb,
  id: string,
  body: AtualizarContatoBody,
): Promise<ContatoDto> {
  const atual = await repo.buscar(tdb, id);

  const valores: Partial<Omit<ContatoRow, 'id' | 'tenantId'>> = {};
  if (body.tipo !== undefined) valores.tipo = body.tipo;
  if (body.nome !== undefined) valores.nome = body.nome;
  if (body.documento !== undefined) {
    const doc = resolverDocumento(body.documento);
    if (doc.documento && doc.documento !== atual.documento) {
      await garantirDocumentoUnico(tdb, doc.documento, id);
    }
    valores.documento = doc.documento;
    valores.tipoDocumento = doc.tipoDocumento;
  }
  if (body.email !== undefined) valores.email = body.email ?? null;
  if (body.telefone !== undefined) valores.telefone = body.telefone ?? null;
  if (body.observacoes !== undefined) valores.observacoes = body.observacoes ?? null;
  if (body.ativo !== undefined) valores.ativo = body.ativo;
  Object.assign(valores, colunasEndereco(body.endereco));

  if (Object.keys(valores).length === 0) return toContatoDto(atual);
  return toContatoDto(await repo.atualizar(tdb, id, valores));
}

/** Soft delete: o contato some das listas, mas lançamentos/títulos/notas continuam ligados a ele. */
export async function excluir(tdb: TenantDb, id: string): Promise<void> {
  await repo.excluir(tdb, id);
}

export async function listarLancamentos(
  tdb: TenantDb,
  id: string,
  query: ContatoLancamentosQuery,
): Promise<ListaLancamentosResponse> {
  const contato = await repo.buscar(tdb, id);
  const paginacao = parsePaginacao(query);
  const { linhas, total, totais } = await repo.listarLancamentos(
    tdb,
    id,
    { de: query.de, ate: query.ate },
    paginacao,
  );
  return {
    ...paginado(
      linhas.map((l) => toLancamentoDto(l, contato)),
      total,
      paginacao.page,
      paginacao.pageSize,
    ),
    totais: {
      receitas: totais.receitas,
      despesas: totais.despesas,
      saldo: totais.receitas - totais.despesas,
    },
  };
}

/**
 * Resumo financeiro do contato:
 * - totalReceitas/totalDespesas/saldo: lançamentos pagos;
 * - aReceber/aPagar: lançamentos pendentes + parcelas em aberto de títulos do contato;
 * - atrasado*: os mesmos, com data/vencimento anterior a hoje;
 * - notasFiscais: quantidade de notas (não excluídas) emitidas para o contato.
 */
export async function resumo(tdb: TenantDb, id: string, hoje: string): Promise<ContatoResumoDto> {
  await repo.buscar(tdb, id);
  const [lanc, parc, notas] = await Promise.all([
    repo.agregarLancamentos(tdb, id, hoje),
    repo.agregarParcelasAbertas(tdb, id, hoje),
    repo.contarNotasFiscais(tdb, id),
  ]);
  return {
    contatoId: id,
    totalReceitas: lanc.receitasPagas,
    totalDespesas: lanc.despesasPagas,
    saldo: lanc.receitasPagas - lanc.despesasPagas,
    quantidadeLancamentos: lanc.quantidade,
    primeiroLancamento: lanc.primeiro,
    ultimoLancamento: lanc.ultimo,
    aReceber: lanc.receitasPendentes + parc.aReceber,
    aPagar: lanc.despesasPendentes + parc.aPagar,
    atrasadoReceber: lanc.receitasAtrasadas + parc.atrasadoReceber,
    atrasadoPagar: lanc.despesasAtrasadas + parc.atrasadoPagar,
    notasFiscais: notas,
  };
}
