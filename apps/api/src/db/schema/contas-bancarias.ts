// Contas bancárias do MEI (cadastro manual, sem integração bancária): banco/carteira onde o
// dinheiro de cada lançamento entra ou sai. Soft delete; nome único por tenant enquanto ativo.
import { sql } from 'drizzle-orm';
import { boolean, index, integer, pgTable, text, unique, uniqueIndex } from 'drizzle-orm/pg-core';

import { id, softDelete, tenantId, timestamps } from './_common.js';
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
