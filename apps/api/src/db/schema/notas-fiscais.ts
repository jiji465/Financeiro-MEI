// Notas fiscais registradas manualmente, com colunas prontas para integração SEFAZ (NfeProvider).
import { relations, sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { dataNegocio, id, softDelete, tenantId, timestamps } from './_common.js';
import { contatos } from './contatos.js';
import { statusNotaEnum, tipoNotaEnum } from './enums.js';
import { lancamentos } from './lancamentos.js';
import { tenants } from './tenants.js';

export const notasFiscais = pgTable(
  'notas_fiscais',
  {
    id: id(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    tipo: tipoNotaEnum('tipo').notNull(),
    numero: text('numero').notNull(),
    serie: text('serie').notNull().default('1'),
    dataEmissao: dataNegocio('data_emissao').notNull(),
    contatoId: uuid('contato_id'),
    valor: integer('valor').notNull(),
    descricao: text('descricao'),
    status: statusNotaEnum('status').notNull().default('emitida'),
    dataCancelamento: dataNegocio('data_cancelamento'),
    motivoCancelamento: text('motivo_cancelamento'),
    /** Receita gerada a partir da nota (origem nota_fiscal). */
    lancamentoId: uuid('lancamento_id'),
    linkExterno: text('link_externo'),
    arquivoPath: text('arquivo_path'),
    arquivoNome: text('arquivo_nome'),
    arquivoMime: text('arquivo_mime'),
    /** Integração: manual | sefaz. */
    provedor: text('provedor').$type<'manual' | 'sefaz'>().notNull().default('manual'),
    chaveAcesso: varchar('chave_acesso', { length: 44 }),
    protocolo: text('protocolo'),
    ambiente: text('ambiente').$type<'producao' | 'homologacao'>(),
    xmlPath: text('xml_path'),
    provedorPayload: jsonb('provedor_payload').$type<Record<string, unknown>>(),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    unique('notas_fiscais_tenant_id_id_unique').on(t.tenantId, t.id),
    foreignKey({
      name: 'notas_fiscais_contato_fk',
      columns: [t.tenantId, t.contatoId],
      foreignColumns: [contatos.tenantId, contatos.id],
    }).onDelete('set null'),
    foreignKey({
      name: 'notas_fiscais_lancamento_fk',
      columns: [t.tenantId, t.lancamentoId],
      foreignColumns: [lancamentos.tenantId, lancamentos.id],
    }).onDelete('set null'),
    check('notas_fiscais_valor_positivo', sql`${t.valor} > 0`),
    uniqueIndex('notas_fiscais_tenant_tipo_serie_numero_idx')
      .on(t.tenantId, t.tipo, t.serie, t.numero)
      .where(sql`${t.deletedAt} is null`),
    index('notas_fiscais_tenant_data_idx').on(t.tenantId, t.dataEmissao),
    index('notas_fiscais_tenant_contato_idx').on(t.tenantId, t.contatoId),
  ],
);

export type NotaFiscalRow = typeof notasFiscais.$inferSelect;
export type NotaFiscalInsert = typeof notasFiscais.$inferInsert;

export const notasFiscaisRelations = relations(notasFiscais, ({ one }) => ({
  contato: one(contatos, {
    fields: [notasFiscais.tenantId, notasFiscais.contatoId],
    references: [contatos.tenantId, contatos.id],
  }),
  lancamento: one(lancamentos, {
    fields: [notasFiscais.tenantId, notasFiscais.lancamentoId],
    references: [lancamentos.tenantId, lancamentos.id],
  }),
}));
