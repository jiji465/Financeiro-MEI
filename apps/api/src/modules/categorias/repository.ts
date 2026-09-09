// Acesso a dados de categorias. Único lugar do módulo que chama select/insert/update/delete.
import { and, asc, eq, ilike, sql } from 'drizzle-orm';

import { categorias, type CategoriaRow } from '../../db/schema/categorias.js';
import { lancamentos, recorrencias } from '../../db/schema/lancamentos.js';
import { configuracoes } from '../../db/schema/tenants.js';
import { titulos } from '../../db/schema/titulos.js';
import type { TenantDb } from '../../lib/tenant-db.js';

export interface FiltroCategorias {
  tipo?: CategoriaRow['tipo'];
  /** true = só ativas (padrão); false = só inativas; undefined com todas=true = todas. */
  ativo?: boolean;
  todas?: boolean;
  busca?: string;
}

export async function listar(tdb: TenantDb, filtro: FiltroCategorias): Promise<CategoriaRow[]> {
  const condicoes = [tdb.scoped(categorias)];
  if (filtro.tipo) condicoes.push(eq(categorias.tipo, filtro.tipo));
  if (filtro.ativo !== undefined) condicoes.push(eq(categorias.ativo, filtro.ativo));
  else if (!filtro.todas) condicoes.push(eq(categorias.ativo, true));
  if (filtro.busca) condicoes.push(ilike(categorias.nome, `%${escaparLike(filtro.busca)}%`));
  return tdb.exec
    .select()
    .from(categorias)
    .where(and(...condicoes))
    .orderBy(asc(categorias.tipo), asc(categorias.ordem), asc(categorias.nome));
}

function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function buscar(tdb: TenantDb, id: string): Promise<CategoriaRow> {
  return tdb.findById(categorias, id);
}

export function buscarOuNull(tdb: TenantDb, id: string): Promise<CategoriaRow | null> {
  return tdb.findByIdOrNull(categorias, id);
}

export async function buscarPorNome(
  tdb: TenantDb,
  tipo: CategoriaRow['tipo'],
  nome: string,
): Promise<CategoriaRow | null> {
  const linhas = await tdb.exec
    .select()
    .from(categorias)
    .where(
      and(
        tdb.scoped(categorias),
        eq(categorias.tipo, tipo),
        sql`lower(${categorias.nome}) = lower(${nome})`,
      ),
    )
    .limit(1);
  return linhas[0] ?? null;
}

export function criar(
  tdb: TenantDb,
  valores: Omit<typeof categorias.$inferInsert, 'tenantId' | 'id'>,
): Promise<CategoriaRow> {
  return tdb.insert(categorias, valores);
}

export function atualizar(
  tdb: TenantDb,
  id: string,
  valores: Partial<Omit<typeof categorias.$inferInsert, 'tenantId' | 'id'>>,
): Promise<CategoriaRow> {
  return tdb.update(categorias, id, valores);
}

export function excluir(tdb: TenantDb, id: string): Promise<void> {
  return tdb.hardDelete(categorias, id);
}

export interface ReferenciasCategoria {
  lancamentos: number;
  recorrencias: number;
  titulos: number;
  configuracoes: number;
  total: number;
}

/** Quantos registros apontam para a categoria (inclui lançamentos excluídos: a FK continua lá). */
export async function contarReferencias(tdb: TenantDb, id: string): Promise<ReferenciasCategoria> {
  const [lanc] = await tdb.exec
    .select({ n: tdb.countInt() })
    .from(lancamentos)
    .where(and(eq(lancamentos.tenantId, tdb.tenantId), eq(lancamentos.categoriaId, id)));
  const [rec] = await tdb.exec
    .select({ n: tdb.countInt() })
    .from(recorrencias)
    .where(and(eq(recorrencias.tenantId, tdb.tenantId), eq(recorrencias.categoriaId, id)));
  const [tit] = await tdb.exec
    .select({ n: tdb.countInt() })
    .from(titulos)
    .where(and(eq(titulos.tenantId, tdb.tenantId), eq(titulos.categoriaId, id)));
  const [cfg] = await tdb.exec
    .select({ n: tdb.countInt() })
    .from(configuracoes)
    .where(and(eq(configuracoes.tenantId, tdb.tenantId), eq(configuracoes.categoriaDasId, id)));
  const contagem = {
    lancamentos: lanc?.n ?? 0,
    recorrencias: rec?.n ?? 0,
    titulos: tit?.n ?? 0,
    configuracoes: cfg?.n ?? 0,
  };
  return {
    ...contagem,
    total: contagem.lancamentos + contagem.recorrencias + contagem.titulos + contagem.configuracoes,
  };
}
