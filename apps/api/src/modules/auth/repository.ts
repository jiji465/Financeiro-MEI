// Acesso a dados de auth: tenants, users, refresh tokens e tokens de redefinição de senha.
// Users e tokens não passam por forTenant: a autenticação acontece antes de haver tenant.
import { and, eq, isNull, sql } from 'drizzle-orm';

import type { DbExecutor } from '../../db/index.js';
import {
  passwordResetTokens,
  type PasswordResetTokenInsert,
  type PasswordResetTokenRow,
  refreshTokens,
  type RefreshTokenInsert,
  type RefreshTokenRow,
  type UserInsert,
  type UserRow,
  users,
} from '../../db/schema/auth.js';
import { type TenantInsert, type TenantRow, tenants } from '../../db/schema/tenants.js';

// ---------- users / tenants ----------

export async function buscarUserPorEmail(exec: DbExecutor, email: string): Promise<UserRow | null> {
  const linhas = await exec
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);
  return linhas[0] ?? null;
}

export async function buscarUserPorId(exec: DbExecutor, id: string): Promise<UserRow | null> {
  const linhas = await exec.select().from(users).where(eq(users.id, id)).limit(1);
  return linhas[0] ?? null;
}

export async function buscarTenantPorId(exec: DbExecutor, id: string): Promise<TenantRow | null> {
  const linhas = await exec.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return linhas[0] ?? null;
}

export async function buscarTenantPorCnpj(
  exec: DbExecutor,
  cnpj: string,
): Promise<TenantRow | null> {
  const linhas = await exec.select().from(tenants).where(eq(tenants.cnpj, cnpj)).limit(1);
  return linhas[0] ?? null;
}

export async function inserirTenant(exec: DbExecutor, valores: TenantInsert): Promise<TenantRow> {
  const [linha] = await exec.insert(tenants).values(valores).returning();
  if (!linha) throw new Error('INSERT em tenants não devolveu linha');
  return linha;
}

export async function inserirUser(exec: DbExecutor, valores: UserInsert): Promise<UserRow> {
  const [linha] = await exec.insert(users).values(valores).returning();
  if (!linha) throw new Error('INSERT em users não devolveu linha');
  return linha;
}

export async function atualizarUser(
  exec: DbExecutor,
  id: string,
  valores: Partial<Omit<UserInsert, 'id' | 'tenantId'>>,
): Promise<UserRow | null> {
  const [linha] = await exec
    .update(users)
    .set({ ...valores, updatedAt: sql`now()` })
    .where(eq(users.id, id))
    .returning();
  return linha ?? null;
}

// ---------- refresh tokens ----------

export async function inserirRefreshToken(
  exec: DbExecutor,
  valores: RefreshTokenInsert,
): Promise<RefreshTokenRow> {
  const [linha] = await exec.insert(refreshTokens).values(valores).returning();
  if (!linha) throw new Error('INSERT em refresh_tokens não devolveu linha');
  return linha;
}

export async function buscarRefreshPorHash(
  exec: DbExecutor,
  tokenHash: string,
): Promise<RefreshTokenRow | null> {
  const linhas = await exec
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);
  return linhas[0] ?? null;
}

export async function revogarRefreshToken(
  exec: DbExecutor,
  id: string,
  replacedById?: string,
): Promise<void> {
  await exec
    .update(refreshTokens)
    .set({ revokedAt: sql`now()`, ...(replacedById ? { replacedById } : {}) })
    .where(and(eq(refreshTokens.id, id), isNull(refreshTokens.revokedAt)));
}

/** Revoga todos os refresh tokens ativos do usuário (reuso detectado, troca/redefinição de senha). */
export async function revogarRefreshTokensDoUser(
  exec: DbExecutor,
  userId: string,
): Promise<number> {
  const linhas = await exec
    .update(refreshTokens)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)))
    .returning({ id: refreshTokens.id });
  return linhas.length;
}

// ---------- password reset tokens ----------

export async function inserirResetToken(
  exec: DbExecutor,
  valores: PasswordResetTokenInsert,
): Promise<PasswordResetTokenRow> {
  const [linha] = await exec.insert(passwordResetTokens).values(valores).returning();
  if (!linha) throw new Error('INSERT em password_reset_tokens não devolveu linha');
  return linha;
}

export async function buscarResetPorHash(
  exec: DbExecutor,
  tokenHash: string,
): Promise<PasswordResetTokenRow | null> {
  const linhas = await exec
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .limit(1);
  return linhas[0] ?? null;
}

export async function marcarResetUsado(exec: DbExecutor, id: string): Promise<void> {
  await exec
    .update(passwordResetTokens)
    .set({ usedAt: sql`now()` })
    .where(eq(passwordResetTokens.id, id));
}

/** Invalida links anteriores ainda não usados (só o mais recente vale). */
export async function invalidarResetsDoUser(exec: DbExecutor, userId: string): Promise<void> {
  await exec
    .update(passwordResetTokens)
    .set({ usedAt: sql`now()` })
    .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));
}
