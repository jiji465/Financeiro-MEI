// Helpers de coluna compartilhados por todas as tabelas (convenções da seção 3 do plano).
import { timestamp, uuid } from 'drizzle-orm/pg-core';

/** id uuid PK default gen_random_uuid() */
export const id = () => uuid('id').primaryKey().defaultRandom();

/** tenant_id uuid NOT NULL (toda tabela de negócio; combinar com UNIQUE(tenant_id, id)). */
export const tenantId = () => uuid('tenant_id').notNull();

/** created_at / updated_at timestamptz */
export const timestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** deleted_at timestamptz (soft delete) */
export const softDelete = () => ({
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
