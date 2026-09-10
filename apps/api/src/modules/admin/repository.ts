// Consultas do painel de administrador: cruzam tenants/users de propósito (não passam por
// forTenant, que estruturalmente não cruza tenants — ver seção 11 do plano). Único módulo com
// esse privilégio; nunca reaproveitar este padrão em outro lugar.
import { and, asc, desc, eq, gte, ilike, inArray, or, sql } from 'drizzle-orm';

import type { DbExecutor } from '../../db/index.js';
import { type UserRow, users } from '../../db/schema/auth.js';
import { type TenantRow, tenants } from '../../db/schema/tenants.js';
import { solicitacoesAcesso } from '../../db/schema/solicitacoes.js';

export interface ListarTenantsOpcoes {
  busca?: string | undefined;
  ativo?: boolean | undefined;
  page: number;
  pageSize: number;
}

export interface TenantComResumo {
  tenant: TenantRow;
  titularId: string | null;
  emailTitular: string | null;
  titularEhAdmin: boolean;
  totalUsuarios: number;
}

export async function listarTenants(
  exec: DbExecutor,
  opcoes: ListarTenantsOpcoes,
): Promise<{ linhas: TenantComResumo[]; total: number }> {
  const condicoes = [
    // Sempre presente, independente dos demais filtros: tenant interno (de administrador puro)
    // nunca é um MEI de verdade e nunca deve aparecer nesta listagem.
    eq(tenants.interno, false),
    opcoes.ativo !== undefined ? eq(tenants.ativo, opcoes.ativo) : undefined,
    opcoes.busca
      ? or(
          ilike(tenants.nome, `%${opcoes.busca}%`),
          ilike(tenants.emailContato, `%${opcoes.busca}%`),
        )
      : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);
  const condicao = and(...condicoes);

  const [linhasTenant, contagem] = await Promise.all([
    exec
      .select()
      .from(tenants)
      .where(condicao)
      .orderBy(desc(tenants.createdAt))
      .limit(opcoes.pageSize)
      .offset((opcoes.page - 1) * opcoes.pageSize),
    exec
      .select({ total: sql<number>`count(*)::int` })
      .from(tenants)
      .where(condicao),
  ]);
  const total = contagem[0]?.total ?? 0;

  if (linhasTenant.length === 0) return { linhas: [], total };

  const idsTenant = linhasTenant.map((t) => t.id);
  const linhasUser = await exec
    .select()
    .from(users)
    .where(inArray(users.tenantId, idsTenant))
    .orderBy(asc(users.createdAt));

  const linhas = linhasTenant.map((tenant) => {
    const doTenant = linhasUser.filter((u) => u.tenantId === tenant.id);
    const titular = doTenant.find((u) => u.role === 'owner') ?? doTenant[0];
    return {
      tenant,
      titularId: titular?.id ?? null,
      emailTitular: titular?.email ?? null,
      titularEhAdmin: titular?.admin ?? false,
      totalUsuarios: doTenant.length,
    };
  });

  return { linhas, total };
}

export async function buscarTenantComUsuarios(
  exec: DbExecutor,
  tenantId: string,
): Promise<{ tenant: TenantRow; usuarios: UserRow[] } | null> {
  const [tenant] = await exec.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  // Tenant interno (de administrador puro) é tratado como inexistente para o admin — fecha o
  // acesso por UUID direto, além de nunca aparecer em nenhuma listagem.
  if (!tenant || tenant.interno) return null;
  const usuarios = await exec
    .select()
    .from(users)
    .where(eq(users.tenantId, tenantId))
    .orderBy(asc(users.createdAt));
  return { tenant, usuarios };
}

export async function buscarUsuarioPorId(exec: DbExecutor, id: string): Promise<UserRow | null> {
  const [linha] = await exec.select().from(users).where(eq(users.id, id)).limit(1);
  return linha ?? null;
}

export async function definirAtivoTenant(
  exec: DbExecutor,
  tenantId: string,
  ativo: boolean,
): Promise<TenantRow | null> {
  const [linha] = await exec
    .update(tenants)
    .set({ ativo, updatedAt: sql`now()` })
    .where(and(eq(tenants.id, tenantId), eq(tenants.interno, false)))
    .returning();
  return linha ?? null;
}

export async function atualizarUsuario(
  exec: DbExecutor,
  userId: string,
  valores: { ativo?: boolean; admin?: boolean },
): Promise<UserRow | null> {
  const [linha] = await exec
    .update(users)
    .set({ ...valores, updatedAt: sql`now()` })
    .where(eq(users.id, userId))
    .returning();
  return linha ?? null;
}

export interface ResumoPlataforma {
  totalTenants: number;
  totalUsuarios: number;
  tenantsAtivos: number;
  tenantsSuspensos: number;
  cadastrosUltimos30Dias: number;
  solicitacoesPendentes: number;
}

export async function resumoPlataforma(exec: DbExecutor): Promise<ResumoPlataforma> {
  const ha30Dias = new Date(Date.now() - 30 * 86_400_000).toISOString();
  // Tenants internos (administradores puros) nunca contam como MEI/usuário real nestes números.
  const naoInterno = eq(tenants.interno, false);
  const [rTotalTenants, rTotalUsuarios, rTenantsAtivos, rCadastros30d, rSolicitacoesPendentes] =
    await Promise.all([
      exec
        .select({ n: sql<number>`count(*)::int` })
        .from(tenants)
        .where(naoInterno),
      exec
        .select({ n: sql<number>`count(*)::int` })
        .from(users)
        .innerJoin(tenants, eq(users.tenantId, tenants.id))
        .where(naoInterno),
      exec
        .select({ n: sql<number>`count(*)::int` })
        .from(tenants)
        .where(and(naoInterno, eq(tenants.ativo, true))),
      exec
        .select({ n: sql<number>`count(*)::int` })
        .from(tenants)
        .where(and(naoInterno, gte(tenants.createdAt, ha30Dias))),
      exec
        .select({ n: sql<number>`count(*)::int` })
        .from(solicitacoesAcesso)
        .where(eq(solicitacoesAcesso.status, 'pendente')),
    ]);

  const totalTenants = rTotalTenants[0]?.n ?? 0;
  const tenantsAtivos = rTenantsAtivos[0]?.n ?? 0;

  return {
    totalTenants,
    totalUsuarios: rTotalUsuarios[0]?.n ?? 0,
    tenantsAtivos,
    tenantsSuspensos: totalTenants - tenantsAtivos,
    cadastrosUltimos30Dias: rCadastros30d[0]?.n ?? 0,
    solicitacoesPendentes: rSolicitacoesPendentes[0]?.n ?? 0,
  };
}
