// Acesso a dados de contas bancárias. Único lugar do módulo que chama select/insert/update/delete.
// Sempre via forTenant (tenant_id + deleted_at IS NULL).
//
// O saldo NUNCA é somado em memória: sai de um LEFT JOIN agregado com lancamentos, filtrando
// status = 'pago' (pendente é previsão, não dinheiro na conta) e ignorando lançamentos excluídos.
import type { IsoDate } from '@meifin/shared';
import { and, asc, desc, eq, gte, lte, or, sql, type SQL } from 'drizzle-orm';
import { alias, type PgColumn } from 'drizzle-orm/pg-core';

import {
  contasBancarias,
  type ContaBancariaRow,
  transferencias,
  type TransferenciaRow,
} from '../../db/schema/contas-bancarias.js';
import { lancamentos } from '../../db/schema/lancamentos.js';
import type { TenantDb } from '../../lib/tenant-db.js';

export interface FiltroContasBancarias {
  /** Omitido = ativas e inativas; true = só ativas; false = só inativas. */
  ativo?: boolean;
}

/** Conta + agregados dos lançamentos e das transferências vinculadas (centavos). */
export interface ContaComSaldo {
  conta: ContaBancariaRow;
  receitas: number;
  despesas: number;
  transferenciasEntrada: number;
  transferenciasSaida: number;
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
 *
 * As transferências entram como SUBCONSULTAS correlacionadas, não como mais dois LEFT JOIN:
 * juntar duas tabelas-filhas na mesma consulta multiplicaria as linhas (produto cartesiano) e
 * uma conta com 3 lançamentos e 2 transferências somaria receitas 6 vezes. Cada subconsulta
 * agrega sozinha, então o `group by` dos lançamentos não a alcança.
 */
function consultaComSaldo(tdb: TenantDb) {
  const somaPaga = (tipo: 'receita' | 'despesa') =>
    tdb.sumInt(
      sql`case when ${lancamentos.tipo} = ${tipo} and ${lancamentos.status} = 'pago' then ${lancamentos.valor} else 0 end`,
    );
  const somaTransferencias = (coluna: PgColumn) =>
    sql<number>`(
      select coalesce(sum(${transferencias.valor}), 0)::int
      from ${transferencias}
      where ${transferencias.tenantId} = ${contasBancarias.tenantId}
        and ${coluna} = ${contasBancarias.id}
        and ${transferencias.deletedAt} is null
    )`;
  return tdb.exec
    .select({
      conta: contasBancarias,
      receitas: somaPaga('receita'),
      despesas: somaPaga('despesa'),
      transferenciasEntrada: somaTransferencias(transferencias.contaDestinoId),
      transferenciasSaida: somaTransferencias(transferencias.contaOrigemId),
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

/** Como `buscar`, mas devolve null em vez de lançar — para validar referências com erro próprio. */
export function buscarOuNulo(tdb: TenantDb, id: string): Promise<ContaBancariaRow | null> {
  return tdb.findByIdOrNull(contasBancarias, id);
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

// ---------------------------------------------------------------------------
// Transferências entre contas do próprio MEI
// ---------------------------------------------------------------------------

export interface FiltroTransferencias {
  de?: IsoDate;
  ate?: IsoDate;
  /** Saíram OU entraram nesta conta. */
  contaId?: string;
  page: number;
  pageSize: number;
}

/** Transferência com as duas contas resumidas (a tela mostra "de X para Y"). */
export interface TransferenciaComContas {
  transferencia: TransferenciaRow;
  contaOrigem: ContaRefRow | null;
  contaDestino: ContaRefRow | null;
}

export type ContaRefRow = Pick<ContaBancariaRow, 'id' | 'nome' | 'instituicao' | 'tipo'>;

// Duas aparições da MESMA tabela na consulta ("de X para Y") — cada uma precisa do seu alias.
const origem = alias(contasBancarias, 'conta_origem');
const destino = alias(contasBancarias, 'conta_destino');

const colunasTransferencia = {
  transferencia: transferencias,
  contaOrigem: {
    id: origem.id,
    nome: origem.nome,
    instituicao: origem.instituicao,
    tipo: origem.tipo,
  },
  contaDestino: {
    id: destino.id,
    nome: destino.nome,
    instituicao: destino.instituicao,
    tipo: destino.tipo,
  },
} as const;

const juncaoOrigem = and(
  eq(origem.tenantId, transferencias.tenantId),
  eq(origem.id, transferencias.contaOrigemId),
);
const juncaoDestino = and(
  eq(destino.tenantId, transferencias.tenantId),
  eq(destino.id, transferencias.contaDestinoId),
);

function condicoesTransferencias(tdb: TenantDb, f: FiltroTransferencias): SQL {
  const lista: SQL[] = [tdb.scoped(transferencias)];
  if (f.de) lista.push(gte(transferencias.data, f.de));
  if (f.ate) lista.push(lte(transferencias.data, f.ate));
  if (f.contaId) {
    lista.push(
      or(
        eq(transferencias.contaOrigemId, f.contaId),
        eq(transferencias.contaDestinoId, f.contaId),
      ) as SQL,
    );
  }
  return and(...lista) as SQL;
}

export async function listarTransferencias(
  tdb: TenantDb,
  f: FiltroTransferencias,
): Promise<{ itens: TransferenciaComContas[]; total: number }> {
  const where = condicoesTransferencias(tdb, f);
  const itens = await tdb.exec
    .select(colunasTransferencia)
    .from(transferencias)
    .leftJoin(origem, juncaoOrigem)
    .leftJoin(destino, juncaoDestino)
    .where(where)
    .orderBy(desc(transferencias.data), desc(transferencias.createdAt))
    .limit(f.pageSize)
    .offset((f.page - 1) * f.pageSize);
  const [contagem] = await tdb.exec.select({ n: tdb.countInt() }).from(transferencias).where(where);
  return { itens, total: contagem?.n ?? 0 };
}

export async function buscarTransferencia(
  tdb: TenantDb,
  id: string,
): Promise<TransferenciaComContas | null> {
  const linhas = await tdb.exec
    .select(colunasTransferencia)
    .from(transferencias)
    .leftJoin(origem, juncaoOrigem)
    .leftJoin(destino, juncaoDestino)
    .where(and(tdb.scoped(transferencias), eq(transferencias.id, id)))
    .limit(1);
  return linhas[0] ?? null;
}

export function criarTransferencia(
  tdb: TenantDb,
  valores: Omit<typeof transferencias.$inferInsert, 'tenantId' | 'id'>,
): Promise<TransferenciaRow> {
  return tdb.insert(transferencias, valores);
}

/** Estorno = soft delete, mesma semântica do lançamento. 0 linhas → 404. */
export function estornarTransferencia(tdb: TenantDb, id: string): Promise<void> {
  return tdb.softDelete(transferencias, id);
}
