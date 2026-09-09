// Clientes e fornecedores (soft delete). Documento (CPF/CNPJ) único por tenant enquanto ativo.
import { sql } from 'drizzle-orm';
import { boolean, index, pgTable, text, unique, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

import { id, softDelete, tenantId, timestamps } from './_common.js';
import { tipoContatoEnum } from './enums.js';
import { tenants } from './tenants.js';

export const contatos = pgTable(
  'contatos',
  {
    id: id(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    tipo: tipoContatoEnum('tipo').notNull(),
    nome: text('nome').notNull(),
    /** CPF (11) ou CNPJ (14) normalizado, sem pontuação. */
    documento: varchar('documento', { length: 14 }),
    tipoDocumento: varchar('tipo_documento', { length: 4 }).$type<'cpf' | 'cnpj'>(),
    email: text('email'),
    telefone: text('telefone'),
    logradouro: text('logradouro'),
    numero: text('numero'),
    complemento: text('complemento'),
    bairro: text('bairro'),
    cidade: text('cidade'),
    uf: varchar('uf', { length: 2 }),
    cep: varchar('cep', { length: 8 }),
    observacoes: text('observacoes'),
    ativo: boolean('ativo').notNull().default(true),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    unique('contatos_tenant_id_id_unique').on(t.tenantId, t.id),
    uniqueIndex('contatos_tenant_documento_idx')
      .on(t.tenantId, t.documento)
      .where(sql`${t.documento} is not null and ${t.deletedAt} is null`),
    index('contatos_tenant_tipo_idx').on(t.tenantId, t.tipo),
    index('contatos_tenant_nome_idx').on(t.tenantId, t.nome),
  ],
);

export type ContatoRow = typeof contatos.$inferSelect;
export type ContatoInsert = typeof contatos.$inferInsert;
