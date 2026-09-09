// Camada 2 do isolamento multi-tenant (seção 6 do plano): todo acesso a tabelas de negócio passa
// por forTenant(exec, tenantId), que força tenant_id em inserts e filtra por tenant_id (e
// deleted_at IS NULL) em leituras/updates. 0 linhas afetadas → NotFoundError (nunca 403).
import { and, eq, isNull, sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import type { AnyPgColumn, PgInsertValue, PgTable, PgUpdateSetSource } from 'drizzle-orm/pg-core';

import type { DbExecutor } from '../db/index.js';
import { NotFoundError } from './errors.js';

/** Tabela de negócio: tem tenant_id e id; deleted_at é opcional (soft delete). */
export type TenantTable = PgTable & {
  tenantId: AnyPgColumn;
  id: AnyPgColumn;
  deletedAt?: AnyPgColumn;
  updatedAt?: AnyPgColumn;
};

export type SoftDeleteTable = TenantTable & { deletedAt: AnyPgColumn };

export interface ScopedOptions {
  /** Inclui registros com deleted_at preenchido (padrão: false). */
  incluirExcluidos?: boolean;
}

export interface TenantDb {
  readonly tenantId: string;
  readonly exec: DbExecutor;
  /** Condição WHERE: tenant_id = :tenant (AND deleted_at IS NULL quando a tabela tem soft delete). */
  scoped<T extends TenantTable>(table: T, opts?: ScopedOptions): SQL;
  /** INSERT com tenant_id forçado; devolve a linha criada. */
  insert<T extends TenantTable>(
    table: T,
    values: Omit<T['$inferInsert'], 'tenantId'>,
  ): Promise<T['$inferSelect']>;
  /** SELECT por id dentro do tenant; 0 linhas → NotFoundError. */
  findById<T extends TenantTable>(
    table: T,
    id: string,
    opts?: ScopedOptions,
  ): Promise<T['$inferSelect']>;
  /** SELECT por id dentro do tenant; null quando não existe. */
  findByIdOrNull<T extends TenantTable>(
    table: T,
    id: string,
    opts?: ScopedOptions,
  ): Promise<T['$inferSelect'] | null>;
  /** UPDATE por id dentro do tenant (updated_at = now()); 0 linhas → NotFoundError. */
  update<T extends TenantTable>(
    table: T,
    id: string,
    values: PgUpdateSetSource<T>,
  ): Promise<T['$inferSelect']>;
  /** Soft delete (deleted_at = now()); 0 linhas → NotFoundError. */
  softDelete<T extends SoftDeleteTable>(table: T, id: string): Promise<void>;
  /** DELETE físico por id dentro do tenant; 0 linhas → NotFoundError. */
  hardDelete<T extends TenantTable>(table: T, id: string): Promise<void>;
  /** coalesce(sum(col), 0)::int — agregado inteiro em centavos (nunca string/bigint). */
  sumInt(col: SQLWrapper): SQL<number>;
  /** count(*)::int */
  countInt(): SQL<number>;
}

function temColuna(table: PgTable, nome: string): boolean {
  return Object.prototype.hasOwnProperty.call(table, nome);
}

export function forTenant(exec: DbExecutor, tenantId: string): TenantDb {
  if (!tenantId) throw new Error('forTenant exige tenantId');

  const scoped = <T extends TenantTable>(table: T, opts: ScopedOptions = {}): SQL => {
    const porTenant = eq(table.tenantId, tenantId);
    if (opts.incluirExcluidos || !table.deletedAt) return porTenant;
    return and(porTenant, isNull(table.deletedAt)) as SQL;
  };

  const porId = <T extends TenantTable>(table: T, id: string, opts?: ScopedOptions): SQL =>
    and(scoped(table, opts), eq(table.id, id)) as SQL;

  const findByIdOrNull = async <T extends TenantTable>(
    table: T,
    id: string,
    opts?: ScopedOptions,
  ): Promise<T['$inferSelect'] | null> => {
    const linhas = (await exec
      .select()
      .from(table as PgTable)
      .where(porId(table, id, opts))
      .limit(1)) as T['$inferSelect'][];
    return linhas[0] ?? null;
  };

  return {
    tenantId,
    exec,
    scoped,

    async insert(table, values) {
      const linhas = (await exec
        .insert(table)
        .values({ ...(values as object), tenantId } as PgInsertValue<typeof table>)
        .returning()) as (typeof table)['$inferSelect'][];
      const linha = linhas[0];
      if (!linha) throw new Error(`INSERT em ${nomeTabela(table)} não devolveu linha`);
      return linha;
    },

    findByIdOrNull,

    async findById(table, id, opts) {
      const linha = await findByIdOrNull(table, id, opts);
      if (!linha) throw new NotFoundError();
      return linha;
    },

    async update(table, id, values) {
      const set = temColuna(table, 'updatedAt')
        ? { ...(values as object), updatedAt: sql`now()` }
        : (values as object);
      const linhas = (await exec
        .update(table)
        .set(set as PgUpdateSetSource<typeof table>)
        .where(porId(table, id))
        .returning()) as (typeof table)['$inferSelect'][];
      const linha = linhas[0];
      if (!linha) throw new NotFoundError();
      return linha;
    },

    async softDelete(table, id) {
      const set = temColuna(table, 'updatedAt')
        ? { deletedAt: sql`now()`, updatedAt: sql`now()` }
        : { deletedAt: sql`now()` };
      const linhas = await exec
        .update(table)
        .set(set as PgUpdateSetSource<typeof table>)
        .where(porId(table, id))
        .returning({ id: table.id });
      if (linhas.length === 0) throw new NotFoundError();
    },

    async hardDelete(table, id) {
      const linhas = await exec.delete(table).where(porId(table, id)).returning({ id: table.id });
      if (linhas.length === 0) throw new NotFoundError();
    },

    sumInt(col) {
      return sql<number>`coalesce(sum(${col}), 0)::int`;
    },

    countInt() {
      return sql<number>`count(*)::int`;
    },
  };
}

function nomeTabela(table: PgTable): string {
  const simbolo = Object.getOwnPropertySymbols(table).find((s) => s.description === 'drizzle:Name');
  return simbolo ? String((table as unknown as Record<symbol, unknown>)[simbolo]) : 'tabela';
}
