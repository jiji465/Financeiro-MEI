// Categorias de receitas/despesas por tenant. "Impostos e DAS" é sistema (indeletável).
import { sql } from 'drizzle-orm';
import { boolean, index, integer, pgTable, text, unique, uniqueIndex } from 'drizzle-orm/pg-core';

import { id, tenantId, timestamps } from './_common.js';
import { grupoDasnEnum, tipoLancamentoEnum } from './enums.js';
import { tenants } from './tenants.js';

export const categorias = pgTable(
  'categorias',
  {
    id: id(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    tipo: tipoLancamentoEnum('tipo').notNull(),
    /** Só para receitas: separa faturamento de comércio e serviços na DASN. */
    grupoDasn: grupoDasnEnum('grupo_dasn'),
    cor: text('cor'),
    icone: text('icone'),
    /** Veio do template padrão aplicado no signup. */
    padrao: boolean('padrao').notNull().default(false),
    /** Categoria de sistema (ex.: Impostos e DAS): não pode ser excluída nem mudar de tipo. */
    sistema: boolean('sistema').notNull().default(false),
    ativo: boolean('ativo').notNull().default(true),
    ordem: integer('ordem').notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    unique('categorias_tenant_id_id_unique').on(t.tenantId, t.id),
    uniqueIndex('categorias_tenant_tipo_nome_idx').on(t.tenantId, t.tipo, sql`lower(${t.nome})`),
    index('categorias_tenant_tipo_idx').on(t.tenantId, t.tipo),
  ],
);

export type CategoriaRow = typeof categorias.$inferSelect;
export type CategoriaInsert = typeof categorias.$inferInsert;
