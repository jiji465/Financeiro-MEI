// Recorrências e lançamentos (receitas/despesas). Valores em centavos, datas AAAA-MM-DD.
import { relations, sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
  boolean,
} from 'drizzle-orm/pg-core';

import { dataNegocio, id, softDelete, tenantId, timestamps } from './_common.js';
import { categorias } from './categorias.js';
import { contatos } from './contatos.js';
import {
  formaPagamentoEnum,
  origemLancamentoEnum,
  statusLancamentoEnum,
  tipoLancamentoEnum,
} from './enums.js';
import { importacoes } from './importacoes.js';
import { tenants } from './tenants.js';

export const recorrencias = pgTable(
  'recorrencias',
  {
    id: id(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    tipo: tipoLancamentoEnum('tipo').notNull(),
    valor: integer('valor').notNull(),
    descricao: text('descricao').notNull(),
    categoriaId: uuid('categoria_id').notNull(),
    contatoId: uuid('contato_id'),
    formaPagamento: formaPagamentoEnum('forma_pagamento').notNull().default('pix'),
    diaDoMes: integer('dia_do_mes').notNull(),
    dataInicio: dataNegocio('data_inicio').notNull(),
    dataFim: dataNegocio('data_fim'),
    ativo: boolean('ativo').notNull().default(true),
    /** Última competência (AAAA-MM-01) já materializada. */
    ultimaCompetencia: dataNegocio('ultima_competencia'),
    ...timestamps(),
  },
  (t) => [
    unique('recorrencias_tenant_id_id_unique').on(t.tenantId, t.id),
    foreignKey({
      name: 'recorrencias_categoria_fk',
      columns: [t.tenantId, t.categoriaId],
      foreignColumns: [categorias.tenantId, categorias.id],
    }),
    foreignKey({
      name: 'recorrencias_contato_fk',
      columns: [t.tenantId, t.contatoId],
      foreignColumns: [contatos.tenantId, contatos.id],
    }).onDelete('set null'),
    check('recorrencias_valor_positivo', sql`${t.valor} > 0`),
    check('recorrencias_dia_do_mes_valido', sql`${t.diaDoMes} between 1 and 31`),
    index('recorrencias_tenant_ativo_idx').on(t.tenantId, t.ativo),
  ],
);

export type RecorrenciaRow = typeof recorrencias.$inferSelect;
export type RecorrenciaInsert = typeof recorrencias.$inferInsert;

export const lancamentos = pgTable(
  'lancamentos',
  {
    id: id(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    tipo: tipoLancamentoEnum('tipo').notNull(),
    data: dataNegocio('data').notNull(),
    valor: integer('valor').notNull(),
    descricao: text('descricao').notNull(),
    categoriaId: uuid('categoria_id').notNull(),
    contatoId: uuid('contato_id'),
    formaPagamento: formaPagamentoEnum('forma_pagamento').notNull().default('pix'),
    status: statusLancamentoEnum('status').notNull().default('pago'),
    dataPagamento: dataNegocio('data_pagamento'),
    observacoes: text('observacoes'),
    anexoPath: text('anexo_path'),
    anexoNome: text('anexo_nome'),
    anexoMime: text('anexo_mime'),
    anexoTamanho: integer('anexo_tamanho'),
    origem: origemLancamentoEnum('origem').notNull().default('manual'),
    recorrenciaId: uuid('recorrencia_id'),
    /** Competência (AAAA-MM-01) quando gerado por recorrência ou DAS. */
    competencia: dataNegocio('competencia'),
    /** Parcela baixada (sem FK: parcelas referenciam lançamentos, evita ciclo). */
    parcelaId: uuid('parcela_id'),
    importacaoId: uuid('importacao_id'),
    /** Hash da linha importada (dedupe). */
    hashImportacao: text('hash_importacao'),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    unique('lancamentos_tenant_id_id_unique').on(t.tenantId, t.id),
    foreignKey({
      name: 'lancamentos_categoria_fk',
      columns: [t.tenantId, t.categoriaId],
      foreignColumns: [categorias.tenantId, categorias.id],
    }),
    foreignKey({
      name: 'lancamentos_contato_fk',
      columns: [t.tenantId, t.contatoId],
      foreignColumns: [contatos.tenantId, contatos.id],
    }).onDelete('set null'),
    foreignKey({
      name: 'lancamentos_recorrencia_fk',
      columns: [t.tenantId, t.recorrenciaId],
      foreignColumns: [recorrencias.tenantId, recorrencias.id],
    }).onDelete('set null'),
    foreignKey({
      name: 'lancamentos_importacao_fk',
      columns: [t.tenantId, t.importacaoId],
      foreignColumns: [importacoes.tenantId, importacoes.id],
    }).onDelete('set null'),
    check('lancamentos_valor_positivo', sql`${t.valor} > 0`),
    uniqueIndex('lancamentos_parcela_idx')
      .on(t.parcelaId)
      .where(sql`${t.parcelaId} is not null and ${t.deletedAt} is null`),
    uniqueIndex('lancamentos_hash_importacao_idx')
      .on(t.tenantId, t.hashImportacao)
      .where(sql`${t.hashImportacao} is not null and ${t.deletedAt} is null`),
    uniqueIndex('lancamentos_recorrencia_competencia_idx')
      .on(t.recorrenciaId, t.competencia)
      .where(sql`${t.recorrenciaId} is not null and ${t.competencia} is not null`),
    index('lancamentos_tenant_data_idx').on(t.tenantId, t.data),
    index('lancamentos_tenant_tipo_status_data_idx').on(t.tenantId, t.tipo, t.status, t.data),
    index('lancamentos_tenant_categoria_idx').on(t.tenantId, t.categoriaId),
    index('lancamentos_tenant_contato_idx').on(t.tenantId, t.contatoId),
  ],
);

export type LancamentoRow = typeof lancamentos.$inferSelect;
export type LancamentoInsert = typeof lancamentos.$inferInsert;

export const recorrenciasRelations = relations(recorrencias, ({ one, many }) => ({
  categoria: one(categorias, {
    fields: [recorrencias.tenantId, recorrencias.categoriaId],
    references: [categorias.tenantId, categorias.id],
  }),
  contato: one(contatos, {
    fields: [recorrencias.tenantId, recorrencias.contatoId],
    references: [contatos.tenantId, contatos.id],
  }),
  lancamentos: many(lancamentos),
}));

export const lancamentosRelations = relations(lancamentos, ({ one }) => ({
  categoria: one(categorias, {
    fields: [lancamentos.tenantId, lancamentos.categoriaId],
    references: [categorias.tenantId, categorias.id],
  }),
  contato: one(contatos, {
    fields: [lancamentos.tenantId, lancamentos.contatoId],
    references: [contatos.tenantId, contatos.id],
  }),
  recorrencia: one(recorrencias, {
    fields: [lancamentos.tenantId, lancamentos.recorrenciaId],
    references: [recorrencias.tenantId, recorrencias.id],
  }),
  importacao: one(importacoes, {
    fields: [lancamentos.tenantId, lancamentos.importacaoId],
    references: [importacoes.tenantId, importacoes.id],
  }),
}));
