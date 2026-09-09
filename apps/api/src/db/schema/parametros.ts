// Parâmetros legais do MEI por ano (global, sem tenant). Seed em db/seed/parametros-mei.ts.
// Valores monetários em centavos; alíquotas em basis points (1% = 100 bp).
import { boolean, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core';

import { timestamps } from './_common.js';

export const parametrosMei = pgTable('parametros_mei', {
  ano: integer('ano').primaryKey(),
  salarioMinimo: integer('salario_minimo').notNull(),
  aliquotaInssBp: integer('aliquota_inss_bp').notNull().default(500),
  aliquotaInssCaminhoneiroBp: integer('aliquota_inss_caminhoneiro_bp').notNull().default(1200),
  icms: integer('icms').notNull().default(100),
  iss: integer('iss').notNull().default(500),
  limiteAnual: integer('limite_anual').notNull().default(8_100_000),
  limiteMensalProporcional: integer('limite_mensal_proporcional').notNull().default(675_000),
  toleranciaExcessoBp: integer('tolerancia_excesso_bp').notNull().default(2000),
  diaVencimentoDas: integer('dia_vencimento_das').notNull().default(20),
  dasnPrazoDia: integer('dasn_prazo_dia').notNull().default(31),
  dasnPrazoMes: integer('dasn_prazo_mes').notNull().default(5),
  alertasLimitePct: jsonb('alertas_limite_pct').$type<number[]>().notNull().default([70, 85, 100]),
  /** false = valores provisórios, a confirmar (ex.: 2025 no seed). */
  confirmado: boolean('confirmado').notNull().default(true),
  observacoes: text('observacoes'),
  ...timestamps(),
});

export type ParametrosMeiRow = typeof parametrosMei.$inferSelect;
export type ParametrosMeiInsert = typeof parametrosMei.$inferInsert;
