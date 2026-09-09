// Helpers de coluna compartilhados por todas as tabelas (convenções da seção 3 do plano).
// Timestamps em modo string (ISO) e datas de negócio como 'AAAA-MM-DD' — nunca Date no domínio.
import { sql } from 'drizzle-orm';
import { date, timestamp, uuid } from 'drizzle-orm/pg-core';

/** id uuid PK default gen_random_uuid() */
export const id = () => uuid('id').primaryKey().defaultRandom();

/** tenant_id uuid NOT NULL (toda tabela de negócio; combinar com UNIQUE(tenant_id, id)). */
export const tenantId = () => uuid('tenant_id').notNull();

/** timestamptz em modo string. */
export const timestamptz = (nome: string) =>
  timestamp(nome, { withTimezone: true, mode: 'string' });

/** Data de negócio (AAAA-MM-DD) em modo string. */
export const dataNegocio = (nome: string) => date(nome, { mode: 'string' });

/** created_at / updated_at timestamptz (strings). */
export const timestamps = () => ({
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

/** deleted_at timestamptz (soft delete). */
export const softDelete = () => ({
  deletedAt: timestamptz('deleted_at'),
});

/** SQL "agora" para updates (updated_at = now()). */
export const agora = () => sql`now()`;
