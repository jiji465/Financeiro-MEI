// Usuários, refresh tokens (opacos, rotacionados) e tokens de redefinição de senha.
import { relations, sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  index,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { id, tenantId, timestamps, timestamptz } from './_common.js';
import { userRoleEnum } from './enums.js';
import { tenants } from './tenants.js';

export const users = pgTable(
  'users',
  {
    id: id(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    email: text('email').notNull(),
    senhaHash: text('senha_hash').notNull(),
    role: userRoleEnum('role').notNull().default('owner'),
    /** Administrador da plataforma (painel /admin) — independente de `role`, que é o papel dentro
     * do próprio tenant. Nunca alterado por rotas públicas. */
    admin: boolean('admin').notNull().default(false),
    ultimoLoginAt: timestamptz('ultimo_login_at'),
    ativo: boolean('ativo').notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    unique('users_tenant_id_id_unique').on(t.tenantId, t.id),
    uniqueIndex('users_email_lower_idx').on(sql`lower(${t.email})`),
    index('users_tenant_idx').on(t.tenantId),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** sha256 (hex) do token opaco; o token em claro só vive no cookie. */
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    revokedAt: timestamptz('revoked_at'),
    /** Token emitido na rotação deste (detecção de reuso). */
    replacedById: uuid('replaced_by_id').references((): AnyPgColumn => refreshTokens.id, {
      onDelete: 'set null',
    }),
    userAgent: text('user_agent'),
    ip: text('ip'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    unique('refresh_tokens_token_hash_unique').on(t.tokenHash),
    index('refresh_tokens_user_idx').on(t.userId),
  ],
);

export type RefreshTokenRow = typeof refreshTokens.$inferSelect;
export type RefreshTokenInsert = typeof refreshTokens.$inferInsert;

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    usedAt: timestamptz('used_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    unique('password_reset_tokens_token_hash_unique').on(t.tokenHash),
    index('password_reset_tokens_user_idx').on(t.userId),
  ],
);

export type PasswordResetTokenRow = typeof passwordResetTokens.$inferSelect;
export type PasswordResetTokenInsert = typeof passwordResetTokens.$inferInsert;

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  refreshTokens: many(refreshTokens),
  passwordResetTokens: many(passwordResetTokens),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
  replacedBy: one(refreshTokens, {
    fields: [refreshTokens.replacedById],
    references: [refreshTokens.id],
  }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, { fields: [passwordResetTokens.userId], references: [users.id] }),
}));
