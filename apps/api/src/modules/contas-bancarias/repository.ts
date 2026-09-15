// Acesso a dados de contas bancárias. Único lugar do módulo que chama select/insert/update/delete.
// Sempre via forTenant (tenant_id + deleted_at IS NULL).
//
// O saldo NUNCA é somado em memória: sai de um LEFT JOIN agregado com lancamentos, filtrando
// status = 'pago' (pendente é previsão, não dinheiro na conta) e ignorando lançamentos excluídos.
import { and, asc, eq, sql, type SQL } from 'drizzle-orm';

import { contasBancarias, type ContaBancariaRow } from '../../db/schema/contas-bancarias.js';
import { lancamentos } from '../../db/schema/lancamentos.js';
import type { TenantDb } from '../../lib/tenant-db.js';

export interface FiltroContasBancarias {
  /** Omitido = ativas e inativas; true = só ativas; false = só inativas. */
  ativo?: boolean;
}

/** Conta + agregados dos lançamentos vinculados (centavos). */
export interface ContaComSaldo {
  conta: ContaBancariaRow;
  receitas: number;
  despesas: number;
  lancamentos: number;
}

function condicoes(tdb: TenantDb, filtro: FiltroContasBancarias): SQL {
  const lista: SQL[] = [tdb.scoped(contasBancarias)];
  if (filtro.ativo !== undefined) lista.push(eq(contasBancarias.ativo, filtro.ativo));
  return and(...lista) as SQL;
}

/**
 * LEFT JOIN por (tenant_id, conta_bancaria_id) — mesmo par da FK composta, então nenhum
 * lançamento de outro tenant entra na conta mesmo que o id colidisse.
 */
function consultaComSaldo(tdb: TenantDb) {
  const somaPaga = (tipo: 'receita' | 'despesa') =>
    tdb.sumInt(
      sql`case when ${lancamentos.tipo} = ${tipo} and ${lancamentos.status} = 'pago' then ${lancamentos.valor} else 0 end`,
    );
  return tdb.exec
    .select({
      conta: contasBancarias,
      receitas: somaPaga('receita'),
      despesas: somaPaga('despesa'),
      // count(*) contaria 1 para conta sem lançamento (a linha nula do LEFT JOIN).
      lancamentos: sql<number>`count(${lancamentos.id})::int`,
    })
    .from(contasBancarias)
    .leftJoin(
      lancamentos,
      and(
        eq(lancamentos.tenantId, contasBancarias.tenantId),
        eq(lancamentos.contaBancariaId, contasBancarias.id),
        sql`${lancamentos.deletedAt} is null`,
      ),
    )
    .groupBy(contasBancarias.id);
}

export async function listarComSaldo(
  tdb: TenantDb,
  filtro: FiltroContasBancarias,
): Promise<ContaComSaldo[]> {
  return consultaComSaldo(tdb)
    .where(condicoes(tdb, filtro))
    .orderBy(asc(contasBancarias.nome), asc(contasBancarias.id));
}

export async function buscarComSaldo(tdb: TenantDb, id: string): Promise<ContaComSaldo | null> {
  const linhas = await consultaComSaldo(tdb)
    .where(and(tdb.scoped(contasBancarias), eq(contasBancarias.id, id)))
    .limit(1);
  return linhas[0] ?? null;
}

/** Lista enxuta para seletores: só ativas, ordenadas por nome (máx. 200). */
export function opcoes(
  tdb: TenantDb,
): Promise<Pick<ContaBancariaRow, 'id' | 'nome' | 'instituicao' | 'tipo'>[]> {
  return tdb.exec
    .select({
      id: contasBancarias.id,
      nome: contasBancarias.nome,
      instituicao: contasBancarias.instituicao,
      tipo: contasBancarias.tipo,
    })
    .from(contasBancarias)
    .where(and(tdb.scoped(contasBancarias), eq(contasBancarias.ativo, true)))
    .orderBy(asc(contasBancarias.nome), asc(contasBancarias.id))
    .limit(200);
}

export function buscar(tdb: TenantDb, id: string): Promise<ContaBancariaRow> {
  return tdb.findById(contasBancarias, id);
}

/** Conta (ativa ou inativa, não excluída) com esse nome — comparação sem diferenciar maiúsculas. */
export async function buscarPorNome(tdb: TenantDb, nome: string): Promise<ContaBancariaRow | null> {
  const linhas = await tdb.exec
    .select()
    .from(contasBancarias)
    .where(and(tdb.scoped(contasBancarias), sql`lower(${contasBancarias.nome}) = lower(${nome})`))
    .limit(1);
  return linhas[0] ?? null;
}

export function criar(
  tdb: TenantDb,
  valores: Omit<typeof contasBancarias.$inferInsert, 'tenantId' | 'id'>,
): Promise<ContaBancariaRow> {
  return tdb.insert(contasBancarias, valores);
}

export function atualizar(
  tdb: TenantDb,
  id: string,
  valores: Partial<Omit<typeof contasBancarias.$inferInsert, 'tenantId' | 'id'>>,
): Promise<ContaBancariaRow> {
  return tdb.update(contasBancarias, id, valores);
}

/**
 * Soft delete. Os lançamentos continuam apontando para a conta (a FK composta segue válida —
 * `scoped` filtra por deleted_at, não apaga o vínculo), então o histórico não se perde.
 */
export function excluir(tdb: TenantDb, id: string): Promise<void> {
  return tdb.softDelete(contasBancarias, id);
}
