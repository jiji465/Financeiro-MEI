// Contas a pagar/receber (títulos) e suas parcelas. A baixa de uma parcela cria um lançamento.
import { relations, sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { dataNegocio, id, softDelete, tenantId, timestamps } from './_common.js';
import { categorias } from './categorias.js';
import { contatos } from './contatos.js';
import {
  formaPagamentoEnum,
  statusParcelaEnum,
  statusTituloEnum,
  tipoTituloEnum,
} from './enums.js';
import { lancamentos } from './lancamentos.js';
import { notasFiscais } from './notas-fiscais.js';
import { tenants } from './tenants.js';

export const titulos = pgTable(
  'titulos',
  {
    id: id(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    tipo: tipoTituloEnum('tipo').notNull(),
    descricao: text('descricao').notNull(),
    contatoId: uuid('contato_id'),
    categoriaId: uuid('categoria_id').notNull(),
    valorTotal: integer('valor_total').notNull(),
    numeroParcelas: integer('numero_parcelas').notNull().default(1),
    dataEmissao: dataNegocio('data_emissao').notNull(),
    notaFiscalId: uuid('nota_fiscal_id'),
    status: statusTituloEnum('status').notNull().default('aberto'),
    observacoes: text('observacoes'),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    unique('titulos_tenant_id_id_unique').on(t.tenantId, t.id),
    foreignKey({
      name: 'titulos_contato_fk',
      columns: [t.tenantId, t.contatoId],
      foreignColumns: [contatos.tenantId, contatos.id],
    }).onDelete('set null'),
    foreignKey({
      name: 'titulos_categoria_fk',
      columns: [t.tenantId, t.categoriaId],
      foreignColumns: [categorias.tenantId, categorias.id],
    }),
    foreignKey({
      name: 'titulos_nota_fiscal_fk',
      columns: [t.tenantId, t.notaFiscalId],
      foreignColumns: [notasFiscais.tenantId, notasFiscais.id],
    }).onDelete('set null'),
    check('titulos_valor_total_positivo', sql`${t.valorTotal} > 0`),
    check('titulos_numero_parcelas_positivo', sql`${t.numeroParcelas} >= 1`),
    index('titulos_tenant_tipo_status_idx').on(t.tenantId, t.tipo, t.status),
    index('titulos_tenant_contato_idx').on(t.tenantId, t.contatoId),
  ],
);

export type TituloRow = typeof titulos.$inferSelect;
export type TituloInsert = typeof titulos.$inferInsert;

export const parcelas = pgTable(
  'parcelas',
  {
    id: id(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    tituloId: uuid('titulo_id').notNull(),
    numero: integer('numero').notNull(),
    vencimento: dataNegocio('vencimento').notNull(),
    valor: integer('valor').notNull(),
    status: statusParcelaEnum('status').notNull().default('aberta'),
    lancamentoId: uuid('lancamento_id'),
    dataPagamento: dataNegocio('data_pagamento'),
    valorPago: integer('valor_pago'),
    formaPagamento: formaPagamentoEnum('forma_pagamento'),
    ...timestamps(),
  },
  (t) => [
    unique('parcelas_tenant_id_id_unique').on(t.tenantId, t.id),
    unique('parcelas_titulo_numero_unique').on(t.tituloId, t.numero),
    foreignKey({
      name: 'parcelas_titulo_fk',
      columns: [t.tenantId, t.tituloId],
      foreignColumns: [titulos.tenantId, titulos.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'parcelas_lancamento_fk',
      columns: [t.tenantId, t.lancamentoId],
      foreignColumns: [lancamentos.tenantId, lancamentos.id],
    }).onDelete('set null'),
    check('parcelas_valor_positivo', sql`${t.valor} > 0`),
    check('parcelas_numero_positivo', sql`${t.numero} >= 1`),
    index('parcelas_tenant_status_vencimento_idx').on(t.tenantId, t.status, t.vencimento),
    index('parcelas_tenant_titulo_idx').on(t.tenantId, t.tituloId),
  ],
);

export type ParcelaRow = typeof parcelas.$inferSelect;
export type ParcelaInsert = typeof parcelas.$inferInsert;

export const titulosRelations = relations(titulos, ({ one, many }) => ({
  contato: one(contatos, {
    fields: [titulos.tenantId, titulos.contatoId],
    references: [contatos.tenantId, contatos.id],
  }),
  categoria: one(categorias, {
    fields: [titulos.tenantId, titulos.categoriaId],
    references: [categorias.tenantId, categorias.id],
  }),
  notaFiscal: one(notasFiscais, {
    fields: [titulos.tenantId, titulos.notaFiscalId],
    references: [notasFiscais.tenantId, notasFiscais.id],
  }),
  parcelas: many(parcelas),
}));

export const parcelasRelations = relations(parcelas, ({ one }) => ({
  titulo: one(titulos, {
    fields: [parcelas.tenantId, parcelas.tituloId],
    references: [titulos.tenantId, titulos.id],
  }),
  lancamento: one(lancamentos, {
    fields: [parcelas.tenantId, parcelas.lancamentoId],
    references: [lancamentos.tenantId, lancamentos.id],
  }),
}));
