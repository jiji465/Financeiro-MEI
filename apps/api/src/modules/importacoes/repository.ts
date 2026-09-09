// Acesso a dados da tabela importacoes (histórico de importações CSV).
import { desc } from 'drizzle-orm';

import { importacoes, type ImportacaoRow } from '../../db/schema/importacoes.js';
import type { TenantDb } from '../../lib/tenant-db.js';

export async function listar(
  tdb: TenantDb,
  page: number,
  pageSize: number,
): Promise<{ linhas: ImportacaoRow[]; total: number }> {
  const [linhas, [contagem]] = await Promise.all([
    tdb.exec
      .select()
      .from(importacoes)
      .where(tdb.scoped(importacoes))
      .orderBy(desc(importacoes.createdAt), desc(importacoes.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    tdb.exec.select({ n: tdb.countInt() }).from(importacoes).where(tdb.scoped(importacoes)),
  ]);
  return { linhas, total: contagem?.n ?? 0 };
}

export function buscar(tdb: TenantDb, id: string): Promise<ImportacaoRow> {
  return tdb.findById(importacoes, id);
}

export function criar(
  tdb: TenantDb,
  valores: Omit<typeof importacoes.$inferInsert, 'tenantId' | 'id'>,
): Promise<ImportacaoRow> {
  return tdb.insert(importacoes, valores);
}

export function atualizar(
  tdb: TenantDb,
  id: string,
  valores: Partial<Omit<typeof importacoes.$inferInsert, 'tenantId' | 'id'>>,
): Promise<ImportacaoRow> {
  return tdb.update(importacoes, id, valores);
}

/** Exclusão física; lancamentos.importacao_id vira NULL (FK ON DELETE SET NULL). */
export function excluir(tdb: TenantDb, id: string): Promise<void> {
  return tdb.hardDelete(importacoes, id);
}
