// Importações de CSV (histórico e mapeamento de colunas usado).
import { integer, jsonb, pgTable, text, unique } from 'drizzle-orm/pg-core';

import { id, tenantId, timestamps } from './_common.js';
import { tenants } from './tenants.js';

/** Coluna do CSV usada para cada campo do lançamento (chave = campo, valor = cabeçalho). */
export type MapeamentoImportacao = Record<string, string | undefined>;

export const importacoes = pgTable(
  'importacoes',
  {
    id: id(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    nomeArquivo: text('nome_arquivo').notNull(),
    formato: text('formato').notNull().default('csv'),
    totalLinhas: integer('total_linhas').notNull().default(0),
    importadas: integer('importadas').notNull().default(0),
    ignoradas: integer('ignoradas').notNull().default(0),
    duplicadas: integer('duplicadas').notNull().default(0),
    mapeamento: jsonb('mapeamento').$type<MapeamentoImportacao>().notNull().default({}),
    ...timestamps(),
  },
  (t) => [unique('importacoes_tenant_id_id_unique').on(t.tenantId, t.id)],
);

export type ImportacaoRow = typeof importacoes.$inferSelect;
export type ImportacaoInsert = typeof importacoes.$inferInsert;
