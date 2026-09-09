// Acesso a dados de configuracoes + tenants (uma linha de cada por tenant).
import { eq, sql } from 'drizzle-orm';

import type { DbExecutor } from '../../db/index.js';
import {
  configuracoes,
  type ConfiguracoesInsert,
  type ConfiguracoesRow,
  type TenantInsert,
  type TenantRow,
  tenants,
} from '../../db/schema/tenants.js';
import { NotFoundError } from '../../lib/errors.js';

export interface TenantComConfiguracoes {
  tenant: TenantRow;
  configuracoes: ConfiguracoesRow;
}

export async function obter(exec: DbExecutor, tenantId: string): Promise<TenantComConfiguracoes> {
  const linhas = await exec
    .select({ tenant: tenants, configuracoes })
    .from(tenants)
    .innerJoin(configuracoes, eq(configuracoes.tenantId, tenants.id))
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const linha = linhas[0];
  if (!linha) throw new NotFoundError('Configurações não encontradas');
  return linha;
}

/** Linha padrão criada no signup (categoria DAS é ligada depois de aplicar o template). */
export async function inserirPadrao(
  exec: DbExecutor,
  tenantId: string,
  valores: Partial<Omit<ConfiguracoesInsert, 'tenantId'>> = {},
): Promise<ConfiguracoesRow> {
  const [linha] = await exec
    .insert(configuracoes)
    .values({ tenantId, ...valores })
    .returning();
  if (!linha) throw new Error('INSERT em configuracoes não devolveu linha');
  return linha;
}

export async function atualizarTenant(
  exec: DbExecutor,
  tenantId: string,
  valores: Partial<Omit<TenantInsert, 'id'>>,
): Promise<TenantRow> {
  const [linha] = await exec
    .update(tenants)
    .set({ ...valores, updatedAt: sql`now()` })
    .where(eq(tenants.id, tenantId))
    .returning();
  if (!linha) throw new NotFoundError('MEI não encontrado');
  return linha;
}

export async function atualizarConfiguracoes(
  exec: DbExecutor,
  tenantId: string,
  valores: Partial<Omit<ConfiguracoesInsert, 'tenantId'>>,
): Promise<ConfiguracoesRow> {
  const [linha] = await exec
    .update(configuracoes)
    .set({ ...valores, updatedAt: sql`now()` })
    .where(eq(configuracoes.tenantId, tenantId))
    .returning();
  if (!linha) throw new NotFoundError('Configurações não encontradas');
  return linha;
}
