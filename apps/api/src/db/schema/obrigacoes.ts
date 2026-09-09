// Obrigações do MEI: DAS pagos por competência, declarações DASN por ano e alertas dispensados.
import { relations, sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { dataNegocio, id, tenantId, timestamps, timestamptz } from './_common.js';
import { formaPagamentoEnum, statusDasnEnum } from './enums.js';
import { lancamentos } from './lancamentos.js';
import { tenants } from './tenants.js';

export const dasPagamentos = pgTable(
  'das_pagamentos',
  {
    id: id(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    /** Primeiro dia do mês de competência (AAAA-MM-01). */
    competencia: dataNegocio('competencia').notNull(),
    valorCalculado: integer('valor_calculado').notNull(),
    valorPago: integer('valor_pago').notNull(),
    dataPagamento: dataNegocio('data_pagamento').notNull(),
    formaPagamento: formaPagamentoEnum('forma_pagamento').notNull().default('pix'),
    /** Despesa gerada (origem das) na categoria configurada. */
    lancamentoId: uuid('lancamento_id'),
    observacao: text('observacao'),
    ...timestamps(),
  },
  (t) => [
    unique('das_pagamentos_tenant_id_id_unique').on(t.tenantId, t.id),
    unique('das_pagamentos_tenant_competencia_unique').on(t.tenantId, t.competencia),
    foreignKey({
      name: 'das_pagamentos_lancamento_fk',
      columns: [t.tenantId, t.lancamentoId],
      foreignColumns: [lancamentos.tenantId, lancamentos.id],
    }).onDelete('set null'),
    check('das_pagamentos_valor_pago_nao_negativo', sql`${t.valorPago} >= 0`),
  ],
);

export type DasPagamentoRow = typeof dasPagamentos.$inferSelect;
export type DasPagamentoInsert = typeof dasPagamentos.$inferInsert;

export const dasnDeclaracoes = pgTable(
  'dasn_declaracoes',
  {
    id: id(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    anoBase: integer('ano_base').notNull(),
    faturamentoApurado: integer('faturamento_apurado').notNull().default(0),
    receitaComercio: integer('receita_comercio').notNull().default(0),
    receitaServicos: integer('receita_servicos').notNull().default(0),
    faturamentoDeclarado: integer('faturamento_declarado'),
    status: statusDasnEnum('status').notNull().default('pendente'),
    dataEntrega: dataNegocio('data_entrega'),
    numeroRecibo: text('numero_recibo'),
    ...timestamps(),
  },
  (t) => [
    unique('dasn_declaracoes_tenant_id_id_unique').on(t.tenantId, t.id),
    unique('dasn_declaracoes_tenant_ano_base_unique').on(t.tenantId, t.anoBase),
  ],
);

export type DasnDeclaracaoRow = typeof dasnDeclaracoes.$inferSelect;
export type DasnDeclaracaoInsert = typeof dasnDeclaracoes.$inferInsert;

export const alertasDispensados = pgTable(
  'alertas_dispensados',
  {
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    /** Chave estável do alerta (ex.: das:2026-03:atrasado). */
    chave: text('chave').notNull(),
    dispensadoAte: dataNegocio('dispensado_ate'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: 'alertas_dispensados_pkey', columns: [t.tenantId, t.chave] }),
    index('alertas_dispensados_tenant_idx').on(t.tenantId),
  ],
);

export type AlertaDispensadoRow = typeof alertasDispensados.$inferSelect;
export type AlertaDispensadoInsert = typeof alertasDispensados.$inferInsert;

export const dasPagamentosRelations = relations(dasPagamentos, ({ one }) => ({
  lancamento: one(lancamentos, {
    fields: [dasPagamentos.tenantId, dasPagamentos.lancamentoId],
    references: [lancamentos.tenantId, lancamentos.id],
  }),
}));
