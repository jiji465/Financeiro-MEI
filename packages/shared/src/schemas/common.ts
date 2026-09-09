// Schemas zod reutilizados por todos os módulos (paginação, ids, datas, dinheiro, envelopes).
import { z } from 'zod';

import { ERROR_CODES, PAGINACAO } from '../constants.js';
import { isIsoDate } from '../dates.js';

/** Inteiro em centavos (pode ser negativo em saldos/deltas). */
export const centavos = z.number().int();

/** Inteiro em centavos estritamente positivo (valores de lançamentos, parcelas, notas). */
export const centavosPositivos = z.number().int().positive();

/** Percentual em basis points (0-10000). */
export const basisPoints = z.number().int().min(0).max(10_000);

/** Data de negócio AAAA-MM-DD validada de verdade (rejeita 2026-02-30). */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato AAAA-MM-DD')
  .refine(isIsoDate, 'Data inválida');

/** Competência mensal AAAA-MM. */
export const competencia = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Competência deve ser AAAA-MM');

export const ano = z.coerce.number().int().min(2000).max(2100);

export const uuid = z.uuid();

export const idParam = z.object({ id: uuid });
export type IdParam = z.infer<typeof idParam>;

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINACAO.pageSizeMax)
    .default(PAGINACAO.pageSizePadrao),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;

export const paginationMeta = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type PaginationMeta = z.infer<typeof paginationMeta>;

/** Envelope de lista: { data: T[], meta: { page, pageSize, total } } */
export function paginatedResponse<T extends z.ZodType>(item: T) {
  return z.object({ data: z.array(item), meta: paginationMeta });
}

/** Envelope de item: { data: T } */
export function itemResponse<T extends z.ZodType>(item: T) {
  return z.object({ data: item });
}

export const errorDetail = z.object({ campo: z.string(), mensagem: z.string() });
export type ErrorDetail = z.infer<typeof errorDetail>;

export const errorResponse = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.array(errorDetail).optional(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponse>;

/** Texto curto obrigatório, já sem espaços nas pontas. */
export const textoCurto = z.string().trim().min(1).max(160);

/** Texto opcional (observações etc.); string vazia vira undefined. */
export const textoOpcional = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v === '' ? undefined : v));
