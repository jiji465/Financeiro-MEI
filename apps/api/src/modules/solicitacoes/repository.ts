// Acesso a dados de solicitacoes_acesso. Tabela global (sem tenant_id) — não passa por forTenant.
import { and, desc, eq, sql } from 'drizzle-orm';

import type { DbExecutor } from '../../db/index.js';
import {
  type SolicitacaoAcessoInsert,
  type SolicitacaoAcessoRow,
  solicitacoesAcesso,
} from '../../db/schema/solicitacoes.js';

export async function inserir(
  exec: DbExecutor,
  valores: SolicitacaoAcessoInsert,
): Promise<SolicitacaoAcessoRow> {
  const [linha] = await exec.insert(solicitacoesAcesso).values(valores).returning();
  if (!linha) throw new Error('INSERT em solicitacoes_acesso não devolveu linha');
  return linha;
}

export async function buscarPorId(
  exec: DbExecutor,
  id: string,
): Promise<SolicitacaoAcessoRow | null> {
  const linhas = await exec
    .select()
    .from(solicitacoesAcesso)
    .where(eq(solicitacoesAcesso.id, id))
    .limit(1);
  return linhas[0] ?? null;
}

export interface ListarSolicitacoesOpcoes {
  status?: 'pendente' | 'aprovada' | 'recusada';
  page: number;
  pageSize: number;
}

export async function listar(
  exec: DbExecutor,
  opcoes: ListarSolicitacoesOpcoes,
): Promise<{ linhas: SolicitacaoAcessoRow[]; total: number }> {
  const condicao = opcoes.status ? eq(solicitacoesAcesso.status, opcoes.status) : undefined;
  const [linhas, contagem] = await Promise.all([
    exec
      .select()
      .from(solicitacoesAcesso)
      .where(condicao)
      .orderBy(desc(solicitacoesAcesso.createdAt))
      .limit(opcoes.pageSize)
      .offset((opcoes.page - 1) * opcoes.pageSize),
    exec
      .select({ total: sql<number>`count(*)::int` })
      .from(solicitacoesAcesso)
      .where(condicao),
  ]);
  return { linhas, total: contagem[0]?.total ?? 0 };
}

export async function atualizar(
  exec: DbExecutor,
  id: string,
  valores: Partial<Pick<SolicitacaoAcessoInsert, 'status' | 'observacaoAdmin'>>,
): Promise<SolicitacaoAcessoRow | null> {
  const [linha] = await exec
    .update(solicitacoesAcesso)
    .set({ ...valores, updatedAt: sql`now()` })
    .where(eq(solicitacoesAcesso.id, id))
    .returning();
  return linha ?? null;
}

export async function contarPendentes(exec: DbExecutor): Promise<number> {
  const [linha] = await exec
    .select({ total: sql<number>`count(*)::int` })
    .from(solicitacoesAcesso)
    .where(and(eq(solicitacoesAcesso.status, 'pendente')));
  return linha?.total ?? 0;
}
