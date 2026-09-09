// Regras de categorias: nome único por tipo (case-insensitive), categoria de sistema não pode
// ser excluída nem desativada, categoria referenciada só é desativada. Contratos: @meifin/shared.
import type {
  AtualizarCategoriaBody,
  CategoriaDto,
  CriarCategoriaBody,
  ExcluirCategoriaResponse,
  ListarCategoriasQuery,
} from '@meifin/shared';

import type { CategoriaRow } from '../../db/schema/categorias.js';
import { ConflictError } from '../../lib/errors.js';
import { isoTimestamp } from '../../lib/hoje.js';
import type { TenantDb } from '../../lib/tenant-db.js';
import * as repo from './repository.js';

export function toCategoriaDto(row: CategoriaRow): CategoriaDto {
  return {
    id: row.id,
    nome: row.nome,
    tipo: row.tipo,
    grupoDasn: row.grupoDasn,
    cor: row.cor,
    icone: row.icone,
    padrao: row.padrao,
    sistema: row.sistema,
    ativo: row.ativo,
    ordem: row.ordem,
    createdAt: isoTimestamp(row.createdAt) ?? row.createdAt,
    updatedAt: isoTimestamp(row.updatedAt) ?? row.updatedAt,
  };
}

const conflitoNome = (nome: string) =>
  new ConflictError(`Já existe uma categoria "${nome}" desse tipo`, [
    { campo: 'nome', mensagem: 'Já existe uma categoria com esse nome' },
  ]);

export async function listar(tdb: TenantDb, query: ListarCategoriasQuery): Promise<CategoriaDto[]> {
  const linhas = await repo.listar(tdb, {
    tipo: query.tipo,
    ativo: query.ativo,
    todas: query.todas,
    busca: query.busca,
  });
  return linhas.map(toCategoriaDto);
}

export async function obter(tdb: TenantDb, id: string): Promise<CategoriaDto> {
  return toCategoriaDto(await repo.buscar(tdb, id));
}

export async function criar(tdb: TenantDb, body: CriarCategoriaBody): Promise<CategoriaDto> {
  const existente = await repo.buscarPorNome(tdb, body.tipo, body.nome);
  if (existente) throw conflitoNome(body.nome);
  const criada = await repo.criar(tdb, {
    nome: body.nome,
    tipo: body.tipo,
    grupoDasn: body.tipo === 'receita' ? (body.grupoDasn ?? null) : null,
    cor: body.cor ?? null,
    icone: body.icone ?? null,
    ordem: body.ordem ?? 0,
    ativo: true,
    padrao: false,
    sistema: false,
  });
  return toCategoriaDto(criada);
}

export async function atualizar(
  tdb: TenantDb,
  id: string,
  body: AtualizarCategoriaBody,
): Promise<CategoriaDto> {
  const atual = await repo.buscar(tdb, id);

  if (atual.sistema && body.ativo === false) {
    throw new ConflictError(`A categoria "${atual.nome}" é de sistema e não pode ser desativada`);
  }
  if (body.nome !== undefined && body.nome.toLowerCase() !== atual.nome.toLowerCase()) {
    const duplicada = await repo.buscarPorNome(tdb, atual.tipo, body.nome);
    if (duplicada && duplicada.id !== id) throw conflitoNome(body.nome);
  }

  const atualizada = await repo.atualizar(tdb, id, {
    ...(body.nome !== undefined ? { nome: body.nome } : {}),
    ...(body.grupoDasn !== undefined
      ? { grupoDasn: atual.tipo === 'receita' ? body.grupoDasn : null }
      : {}),
    ...(body.cor !== undefined ? { cor: body.cor } : {}),
    ...(body.icone !== undefined ? { icone: body.icone } : {}),
    ...(body.ordem !== undefined ? { ordem: body.ordem } : {}),
    ...(body.ativo !== undefined ? { ativo: body.ativo } : {}),
  });
  return toCategoriaDto(atualizada);
}

/** Sistema → 409; referenciada (lançamentos, recorrências, títulos, config DAS) → desativa; senão exclui. */
export async function excluir(
  tdb: TenantDb,
  id: string,
): Promise<ExcluirCategoriaResponse['data']> {
  const atual = await repo.buscar(tdb, id);
  if (atual.sistema) {
    throw new ConflictError(`A categoria "${atual.nome}" é de sistema e não pode ser excluída`);
  }
  const referencias = await repo.contarReferencias(tdb, id);
  if (referencias.total > 0) {
    await repo.atualizar(tdb, id, { ativo: false });
    return {
      id,
      excluida: false,
      desativada: true,
      lancamentosVinculados: referencias.lancamentos,
    };
  }
  await repo.excluir(tdb, id);
  return { id, excluida: true, desativada: false, lancamentosVinculados: 0 };
}
