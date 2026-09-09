// Acesso a dados de recorrências + materialização idempotente de lançamentos
// (INSERT … ON CONFLICT (recorrencia_id, competencia) DO NOTHING — seção 5 do plano).
import type { TipoLancamento } from '@meifin/shared';
import { and, asc, eq, sql } from 'drizzle-orm';

import { categorias } from '../../db/schema/categorias.js';
import { contatos } from '../../db/schema/contatos.js';
import { lancamentos, recorrencias, type RecorrenciaRow } from '../../db/schema/lancamentos.js';
import type { TenantDb } from '../../lib/tenant-db.js';
import type { CategoriaRefRow, ContatoRefRow } from './repository.js';

export interface RecorrenciaComRefs {
  recorrencia: RecorrenciaRow;
  categoria: CategoriaRefRow | null;
  contato: ContatoRefRow | null;
}

export interface FiltroRecorrencias {
  tipo?: TipoLancamento;
  ativo?: boolean;
}

type LinhaBruta = {
  recorrencia: RecorrenciaRow;
  categoria: {
    id: string | null;
    nome: string | null;
    cor: string | null;
    icone: string | null;
  } | null;
  contato: { id: string | null; nome: string | null; tipo: string | null } | null;
};

function normalizar(linha: LinhaBruta): RecorrenciaComRefs {
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
  return { recorrencia: linha.recorrencia, categoria, contato };
}

function consultaComRefs(tdb: TenantDb) {
  return tdb.exec
    .select({
      recorrencia: recorrencias,
      categoria: {
        id: categorias.id,
        nome: categorias.nome,
        cor: categorias.cor,
        icone: categorias.icone,
      },
      contato: { id: contatos.id, nome: contatos.nome, tipo: contatos.tipo },
    })
    .from(recorrencias)
    .leftJoin(
      categorias,
      and(
        eq(categorias.tenantId, recorrencias.tenantId),
        eq(categorias.id, recorrencias.categoriaId),
      ),
    )
    .leftJoin(
      contatos,
      and(eq(contatos.tenantId, recorrencias.tenantId), eq(contatos.id, recorrencias.contatoId)),
    );
}

export async function listar(
  tdb: TenantDb,
  filtro: FiltroRecorrencias,
): Promise<RecorrenciaComRefs[]> {
  const cond = [tdb.scoped(recorrencias)];
  if (filtro.tipo) cond.push(eq(recorrencias.tipo, filtro.tipo));
  if (filtro.ativo !== undefined) cond.push(eq(recorrencias.ativo, filtro.ativo));
  const linhas = (await consultaComRefs(tdb)
    .where(and(...cond))
    .orderBy(asc(recorrencias.diaDoMes), asc(recorrencias.descricao))) as LinhaBruta[];
  return linhas.map(normalizar);
}

export async function buscarComRefs(tdb: TenantDb, id: string): Promise<RecorrenciaComRefs | null> {
  const [linha] = (await consultaComRefs(tdb)
    .where(and(tdb.scoped(recorrencias), eq(recorrencias.id, id)))
    .limit(1)) as LinhaBruta[];
  return linha ? normalizar(linha) : null;
}

export function buscar(tdb: TenantDb, id: string): Promise<RecorrenciaRow> {
  return tdb.findById(recorrencias, id);
}

export function buscarOuNull(tdb: TenantDb, id: string): Promise<RecorrenciaRow | null> {
  return tdb.findByIdOrNull(recorrencias, id);
}

export function listarAtivas(tdb: TenantDb): Promise<RecorrenciaRow[]> {
  return tdb.exec
    .select()
    .from(recorrencias)
    .where(and(tdb.scoped(recorrencias), eq(recorrencias.ativo, true)))
    .orderBy(asc(recorrencias.createdAt));
}

export function criar(
  tdb: TenantDb,
  valores: Omit<typeof recorrencias.$inferInsert, 'tenantId' | 'id'>,
): Promise<RecorrenciaRow> {
  return tdb.insert(recorrencias, valores);
}

export function atualizar(
  tdb: TenantDb,
  id: string,
  valores: Partial<Omit<typeof recorrencias.$inferInsert, 'tenantId' | 'id'>>,
): Promise<RecorrenciaRow> {
  return tdb.update(recorrencias, id, valores);
}

/** Exclusão física: lancamentos.recorrencia_id vira NULL (FK ON DELETE SET NULL). */
export function excluir(tdb: TenantDb, id: string): Promise<void> {
  return tdb.hardDelete(recorrencias, id);
}

export interface CompetenciaAMaterializar {
  /** AAAA-MM-01 */
  competencia: string;
  /** Data do lançamento (dia do mês com clamp). */
  data: string;
}

/**
 * Insere os lançamentos pendentes de uma recorrência (status pendente, origem recorrencia) com
 * ON CONFLICT (recorrencia_id, competencia) DO NOTHING — chamadas repetidas não duplicam.
 * Devolve só as competências efetivamente inseridas.
 */
export async function materializar(
  tdb: TenantDb,
  rec: RecorrenciaRow,
  competencias: CompetenciaAMaterializar[],
): Promise<{ id: string; competencia: string }[]> {
  if (competencias.length === 0) return [];
  const linhas = await tdb.exec
    .insert(lancamentos)
    .values(
      competencias.map((c) => ({
        tenantId: tdb.tenantId,
        tipo: rec.tipo,
        data: c.data,
        valor: rec.valor,
        descricao: rec.descricao,
        categoriaId: rec.categoriaId,
        contatoId: rec.contatoId,
        formaPagamento: rec.formaPagamento,
        status: 'pendente' as const,
        dataPagamento: null,
        origem: 'recorrencia' as const,
        recorrenciaId: rec.id,
        competencia: c.competencia,
      })),
    )
    .onConflictDoNothing({
      target: [lancamentos.recorrenciaId, lancamentos.competencia],
      where: sql`${lancamentos.recorrenciaId} is not null and ${lancamentos.competencia} is not null`,
    })
    .returning({ id: lancamentos.id, competencia: lancamentos.competencia });
  return linhas.map((l) => ({ id: l.id, competencia: l.competencia ?? '' }));
}
