// Regras de contas bancárias: cadastro manual (sem integração), nome único por MEI (409 no campo
// "nome"), soft delete que preserva o vínculo dos lançamentos e saldo agregado no banco.
// Contratos: @meifin/shared/schemas/contas-bancarias.
import type {
  AtualizarContaBancariaBody,
  ContaBancariaOpcaoDto,
  ContaBancariaSaldoDto,
  CriarContaBancariaBody,
  ListaContasBancariasResponse,
  ListarContasBancariasQuery,
} from '@meifin/shared';

import type { ContaBancariaRow } from '../../db/schema/contas-bancarias.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
import { isoTimestamp } from '../../lib/hoje.js';
import type { TenantDb } from '../../lib/tenant-db.js';
import * as repo from './repository.js';

/** saldo = saldo inicial + receitas pagas − despesas pagas vinculadas à conta. */
export function toContaBancariaDto(linha: repo.ContaComSaldo): ContaBancariaSaldoDto {
  const c = linha.conta;
  return {
    id: c.id,
    nome: c.nome,
    instituicao: c.instituicao,
    tipo: c.tipo,
    saldoInicial: c.saldoInicial,
    ativo: c.ativo,
    saldo: c.saldoInicial + linha.receitas - linha.despesas,
    receitas: linha.receitas,
    despesas: linha.despesas,
    lancamentos: linha.lancamentos,
    createdAt: isoTimestamp(c.createdAt) ?? c.createdAt,
    updatedAt: isoTimestamp(c.updatedAt) ?? c.updatedAt,
  };
}

export function toContaBancariaOpcaoDto(
  row: Pick<ContaBancariaRow, 'id' | 'nome' | 'instituicao' | 'tipo'>,
): ContaBancariaOpcaoDto {
  return { id: row.id, nome: row.nome, instituicao: row.instituicao, tipo: row.tipo };
}

async function garantirNomeUnico(tdb: TenantDb, nome: string, ignorarId?: string) {
  const existente = await repo.buscarPorNome(tdb, nome);
  if (existente && existente.id !== ignorarId) {
    throw new ConflictError(`Já existe uma conta chamada "${existente.nome}"`, [
      { campo: 'nome', mensagem: 'Já existe uma conta com esse nome' },
    ]);
  }
}

async function obterComSaldo(tdb: TenantDb, id: string): Promise<ContaBancariaSaldoDto> {
  const linha = await repo.buscarComSaldo(tdb, id);
  if (!linha) throw new NotFoundError('Conta bancária não encontrada');
  return toContaBancariaDto(linha);
}

export async function listar(
  tdb: TenantDb,
  query: ListarContasBancariasQuery,
): Promise<ListaContasBancariasResponse> {
  const linhas = await repo.listarComSaldo(tdb, { ativo: query.ativo });
  const data = linhas.map(toContaBancariaDto);
  return {
    data,
    totais: {
      saldoInicial: data.reduce((soma, c) => soma + c.saldoInicial, 0),
      saldo: data.reduce((soma, c) => soma + c.saldo, 0),
    },
  };
}

export async function opcoes(tdb: TenantDb): Promise<ContaBancariaOpcaoDto[]> {
  const linhas = await repo.opcoes(tdb);
  return linhas.map(toContaBancariaOpcaoDto);
}

export function obter(tdb: TenantDb, id: string): Promise<ContaBancariaSaldoDto> {
  return obterComSaldo(tdb, id);
}

export async function criar(
  tdb: TenantDb,
  body: CriarContaBancariaBody,
): Promise<ContaBancariaSaldoDto> {
  await garantirNomeUnico(tdb, body.nome);
  const criada = await repo.criar(tdb, {
    nome: body.nome,
    instituicao: body.instituicao ?? null,
    tipo: body.tipo,
    saldoInicial: body.saldoInicial,
    ativo: true,
  });
  return obterComSaldo(tdb, criada.id);
}

export async function atualizar(
  tdb: TenantDb,
  id: string,
  body: AtualizarContaBancariaBody,
): Promise<ContaBancariaSaldoDto> {
  const atual = await repo.buscar(tdb, id);

  const valores: Partial<Omit<ContaBancariaRow, 'id' | 'tenantId'>> = {};
  if (body.nome !== undefined && body.nome !== atual.nome) {
    await garantirNomeUnico(tdb, body.nome, id);
    valores.nome = body.nome;
  }
  if (body.instituicao !== undefined) valores.instituicao = body.instituicao ?? null;
  if (body.tipo !== undefined) valores.tipo = body.tipo;
  if (body.saldoInicial !== undefined) valores.saldoInicial = body.saldoInicial;
  if (body.ativo !== undefined) valores.ativo = body.ativo;

  if (Object.keys(valores).length > 0) await repo.atualizar(tdb, id, valores);
  return obterComSaldo(tdb, id);
}

/**
 * Soft delete: a conta some das listas e dos seletores, mas os lançamentos já vinculados
 * continuam apontando para ela (o histórico não muda de valor).
 */
export async function excluir(tdb: TenantDb, id: string): Promise<void> {
  await repo.excluir(tdb, id);
}
