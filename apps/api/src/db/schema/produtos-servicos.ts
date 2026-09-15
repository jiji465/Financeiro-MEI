// Catálogo do MEI (`produtos_servicos`) e os itens de cada lançamento (`lancamento_itens`).
//
// DISCIPLINA NUMÉRICA — as duas colunas de número são INTEIRAS, nada de float nem `numeric`:
//   - dinheiro em CENTAVOS (`preco_padrao`, `valor_unitario`, `valor_total`), como no resto do
//     sistema;
//   - quantidade em MILÉSIMOS de unidade (`quantidade`): 1 un = 1000, 1,5 kg = 1500, 0,25 h = 250.
//     Três casas cobrem o que um MEI usa (peso, hora, metro) sem abrir a porta para 0,1 + 0,2 ≠ 0,3.
//   - `valor_total` = round(quantidade × valor_unitario / 1000), half-up, calculado pela API em
//     `totalDoItem` (@meifin/shared/money) e GRAVADO — o cliente nunca manda o total.
//
// Soft delete só no catálogo: o item do lançamento é substituído em bloco a cada salvamento, e
// some junto com o lançamento quando ele é apagado de verdade (FK composta com ON DELETE CASCADE).
import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
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

import { id, softDelete, tenantId, timestamps } from './_common.js';
import { tipoProdutoServicoEnum } from './enums.js';
import { lancamentos } from './lancamentos.js';
import { tenants } from './tenants.js';

export const produtosServicos = pgTable(
  'produtos_servicos',
  {
    id: id(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    tipo: tipoProdutoServicoEnum('tipo').notNull(),
    /** Como o dono chama o item: "Bolo de cenoura", "Corte de cabelo". */
    nome: text('nome').notNull(),
    descricao: text('descricao'),
    /** Preço sugerido em centavos; NULL quando o preço é combinado a cada venda. */
    precoPadrao: integer('preco_padrao'),
    /** Unidade de medida em texto livre ("un", "kg", "h", "m²") — não há lista fechada. */
    unidade: text('unidade'),
    ativo: boolean('ativo').notNull().default(true),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    unique('produtos_servicos_tenant_id_id_unique').on(t.tenantId, t.id),
    uniqueIndex('produtos_servicos_tenant_nome_idx')
      .on(t.tenantId, sql`lower(${t.nome})`)
      .where(sql`${t.deletedAt} is null`),
    index('produtos_servicos_tenant_tipo_ativo_idx').on(t.tenantId, t.tipo, t.ativo),
    check(
      'produtos_servicos_preco_nao_negativo',
      sql`${t.precoPadrao} is null or ${t.precoPadrao} >= 0`,
    ),
  ],
);

export type ProdutoServicoRow = typeof produtosServicos.$inferSelect;
export type ProdutoServicoInsert = typeof produtosServicos.$inferInsert;

export const lancamentoItens = pgTable(
  'lancamento_itens',
  {
    id: id(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    lancamentoId: uuid('lancamento_id').notNull(),
    produtoServicoId: uuid('produto_servico_id').notNull(),
    /** Milésimos de unidade, inteiro > 0 (1,5 kg = 1500). */
    quantidade: integer('quantidade').notNull(),
    /** Centavos, inteiro ≥ 0 (um brinde na nota é legítimo; negativo não é). */
    valorUnitario: integer('valor_unitario').notNull(),
    /** Centavos; round(quantidade × valor_unitario / 1000) half-up, calculado pela API. */
    valorTotal: integer('valor_total').notNull(),
    /** Ordem em que o dono digitou as linhas (a tela reabre igual a como foi salva). */
    ordem: integer('ordem').notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    unique('lancamento_itens_tenant_id_id_unique').on(t.tenantId, t.id),
    foreignKey({
      name: 'lancamento_itens_lancamento_fk',
      columns: [t.tenantId, t.lancamentoId],
      foreignColumns: [lancamentos.tenantId, lancamentos.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'lancamento_itens_produto_servico_fk',
      columns: [t.tenantId, t.produtoServicoId],
      foreignColumns: [produtosServicos.tenantId, produtosServicos.id],
    }),
    check('lancamento_itens_quantidade_positiva', sql`${t.quantidade} > 0`),
    check('lancamento_itens_valor_unitario_nao_negativo', sql`${t.valorUnitario} >= 0`),
    check('lancamento_itens_valor_total_nao_negativo', sql`${t.valorTotal} >= 0`),
    index('lancamento_itens_tenant_lancamento_idx').on(t.tenantId, t.lancamentoId),
    index('lancamento_itens_tenant_produto_servico_idx').on(t.tenantId, t.produtoServicoId),
  ],
);

export type LancamentoItemRow = typeof lancamentoItens.$inferSelect;
export type LancamentoItemInsert = typeof lancamentoItens.$inferInsert;

export const produtosServicosRelations = relations(produtosServicos, ({ many }) => ({
  itens: many(lancamentoItens),
}));

export const lancamentoItensRelations = relations(lancamentoItens, ({ one }) => ({
  lancamento: one(lancamentos, {
    fields: [lancamentoItens.tenantId, lancamentoItens.lancamentoId],
    references: [lancamentos.tenantId, lancamentos.id],
  }),
  produtoServico: one(produtosServicos, {
    fields: [lancamentoItens.tenantId, lancamentoItens.produtoServicoId],
    references: [produtosServicos.tenantId, produtosServicos.id],
  }),
}));
