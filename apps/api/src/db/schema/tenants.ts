// Tenants (um por MEI) e suas configurações. Toda tabela de negócio referencia tenants.
import { relations } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { dataNegocio, id, timestamps } from './_common.js';
import { categorias } from './categorias.js';
import { atividadeEnum, caminhoneiroTributosEnum, regimeApuracaoEnum } from './enums.js';

export interface EnderecoJson {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
}

export const tenants = pgTable(
  'tenants',
  {
    id: id(),
    nome: text('nome').notNull(),
    nomeFantasia: text('nome_fantasia'),
    /** 14 caracteres normalizados (maiúsculos, sem pontuação); aceita CNPJ alfanumérico. */
    cnpj: varchar('cnpj', { length: 14 }),
    atividade: atividadeEnum('atividade').notNull(),
    caminhoneiroTributos: caminhoneiroTributosEnum('caminhoneiro_tributos'),
    dataAbertura: dataNegocio('data_abertura'),
    emailContato: text('email_contato'),
    telefone: text('telefone'),
    endereco: jsonb('endereco').$type<EnderecoJson>(),
    ativo: boolean('ativo').notNull().default(true),
    ...timestamps(),
  },
  (t) => [unique('tenants_cnpj_unique').on(t.cnpj)],
);

export type TenantRow = typeof tenants.$inferSelect;
export type TenantInsert = typeof tenants.$inferInsert;

export const configuracoes = pgTable(
  'configuracoes',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    regimeApuracao: regimeApuracaoEnum('regime_apuracao').notNull().default('competencia'),
    diasAlertaVencimento: integer('dias_alerta_vencimento').notNull().default(7),
    diasAlertaDas: integer('dias_alerta_das').notNull().default(7),
    mostrarProjecao: boolean('mostrar_projecao').notNull().default(true),
    categoriaDasId: uuid('categoria_das_id'),
    preferencias: jsonb('preferencias').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps(),
  },
  (t) => [
    primaryKey({ name: 'configuracoes_pkey', columns: [t.tenantId] }),
    foreignKey({
      name: 'configuracoes_categoria_das_fk',
      columns: [t.tenantId, t.categoriaDasId],
      foreignColumns: [categorias.tenantId, categorias.id],
    }).onDelete('set null'),
  ],
);

export type ConfiguracoesRow = typeof configuracoes.$inferSelect;
export type ConfiguracoesInsert = typeof configuracoes.$inferInsert;

export const tenantsRelations = relations(tenants, ({ one }) => ({
  configuracoes: one(configuracoes, {
    fields: [tenants.id],
    references: [configuracoes.tenantId],
  }),
}));

export const configuracoesRelations = relations(configuracoes, ({ one }) => ({
  tenant: one(tenants, { fields: [configuracoes.tenantId], references: [tenants.id] }),
  categoriaDas: one(categorias, {
    fields: [configuracoes.tenantId, configuracoes.categoriaDasId],
    references: [categorias.tenantId, categorias.id],
  }),
}));
