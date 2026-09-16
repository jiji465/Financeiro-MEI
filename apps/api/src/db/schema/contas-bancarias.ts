// Contas bancárias do MEI (cadastro manual, sem integração bancária): banco/carteira onde o
// dinheiro de cada lançamento entra ou sai. Soft delete; nome único por tenant enquanto ativo.
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { dataNegocio, id, softDelete, tenantId, timestamps } from './_common.js';
import { tipoContaBancariaEnum } from './enums.js';
import { tenants } from './tenants.js';

export const contasBancarias = pgTable(
  'contas_bancarias',
  {
    id: id(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    /** Como o dono chama a conta: "Nubank PJ", "Caixa da loja". */
    nome: text('nome').notNull(),
    /** Instituição em texto livre ("Nubank", "Banco do Brasil") — não há lista fechada. */
    instituicao: text('instituicao'),
    tipo: tipoContaBancariaEnum('tipo').notNull().default('corrente'),
    /** Saldo de abertura em centavos; pode ser negativo (conta no vermelho). */
    saldoInicial: integer('saldo_inicial').notNull().default(0),
    ativo: boolean('ativo').notNull().default(true),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    unique('contas_bancarias_tenant_id_id_unique').on(t.tenantId, t.id),
    uniqueIndex('contas_bancarias_tenant_nome_idx')
      .on(t.tenantId, sql`lower(${t.nome})`)
      .where(sql`${t.deletedAt} is null`),
    index('contas_bancarias_tenant_ativo_idx').on(t.tenantId, t.ativo),
  ],
);

export type ContaBancariaRow = typeof contasBancarias.$inferSelect;
export type ContaBancariaInsert = typeof contasBancarias.$inferInsert;

/**
 * Transferência entre duas contas do próprio MEI (ex.: PIX da maquininha para o banco).
 *
 * DELIBERADAMENTE FORA DE `lancamentos`. Tirar dinheiro de uma conta e pôr em outra não é
 * receita nem despesa — o MEI não faturou nada. Se fosse gravada como um par de lançamentos,
 * a receita falsa entraria no acumulado do limite anual de faturamento (a regra que decide se
 * o MEI continua sendo MEI), na DRE, na DASN e em todos os gráficos, e bastaria UMA consulta
 * nova sobre `lancamentos` esquecer de filtrar para o erro voltar. Vinte consultas em sete
 * repositories precisariam saber da exceção.
 *
 * Com tabela própria, só quem quer ver transferência a enxerga: o cálculo de saldo por conta
 * (`contas-bancarias/repository.ts`). Todo o resto continua certo por construção.
 *
 * Estorno = soft delete, mesma semântica do lançamento.
 */
export const transferencias = pgTable(
  'transferencias',
  {
    id: id(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    data: dataNegocio('data').notNull(),
    /** Centavos, inteiro > 0. */
    valor: integer('valor').notNull(),
    contaOrigemId: uuid('conta_origem_id').notNull(),
    contaDestinoId: uuid('conta_destino_id').notNull(),
    descricao: text('descricao'),
    observacoes: text('observacoes'),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    unique('transferencias_tenant_id_id_unique').on(t.tenantId, t.id),
    foreignKey({
      name: 'transferencias_conta_origem_fk',
      columns: [t.tenantId, t.contaOrigemId],
      foreignColumns: [contasBancarias.tenantId, contasBancarias.id],
    }),
    foreignKey({
      name: 'transferencias_conta_destino_fk',
      columns: [t.tenantId, t.contaDestinoId],
      foreignColumns: [contasBancarias.tenantId, contasBancarias.id],
    }),
    check('transferencias_valor_positivo', sql`${t.valor} > 0`),
    check('transferencias_contas_diferentes', sql`${t.contaOrigemId} <> ${t.contaDestinoId}`),
    index('transferencias_tenant_data_idx').on(t.tenantId, t.data),
    index('transferencias_tenant_origem_idx').on(t.tenantId, t.contaOrigemId),
    index('transferencias_tenant_destino_idx').on(t.tenantId, t.contaDestinoId),
  ],
);

export type TransferenciaRow = typeof transferencias.$inferSelect;
export type TransferenciaInsert = typeof transferencias.$inferInsert;
