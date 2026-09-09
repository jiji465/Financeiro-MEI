// Schemas zod reutilizados por todos os módulos (paginação, ids, datas, dinheiro, envelopes).
import { z } from 'zod';

import { ERROR_CODES, PAGINACAO, UFS } from '../constants.js';
import { isCompetencia, isIsoDate } from '../dates.js';

// ---------------------------------------------------------------------------
// Primitivos
// ---------------------------------------------------------------------------

/** Inteiro em centavos (pode ser negativo em saldos/deltas). */
export const centavos = z.number().int('Valor deve ser um inteiro em centavos');

/** Inteiro em centavos ≥ 0. */
export const centavosNaoNegativo = z
  .number()
  .int('Valor deve ser um inteiro em centavos')
  .min(0, 'Valor não pode ser negativo');

/** Inteiro em centavos estritamente positivo (valores de lançamentos, parcelas, notas). */
export const centavosPositivo = z
  .number()
  .int('Valor deve ser um inteiro em centavos')
  .positive('Valor deve ser maior que zero')
  .max(999_999_999_999, 'Valor grande demais');

/** @deprecated use centavosPositivo (mantido por compatibilidade com o bootstrap). */
export const centavosPositivos = centavosPositivo;

/** Percentual em basis points (0-10000). */
export const basisPoints = z.number().int().min(0).max(10_000);

/** Percentual com duas casas (0-100+; projeções podem passar de 100). */
export const percentualNumero = z.number();

/** Data de negócio AAAA-MM-DD validada de verdade (rejeita 2026-02-30). */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Data deve estar no formato AAAA-MM-DD', abort: true })
  .refine(isIsoDate, 'Data inválida');

/** Competência mensal AAAA-MM. */
export const competencia = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: 'Competência deve ser AAAA-MM', abort: true })
  .refine(isCompetencia, 'Competência inválida');

export const ano = z.coerce
  .number()
  .int('Ano inválido')
  .min(2000, 'Ano inválido')
  .max(2100, 'Ano inválido');

/** Ano opcional em query string (?ano=2026). */
export const anoQuery = z.object({ ano: ano.optional() });
export type AnoQuery = z.infer<typeof anoQuery>;

export const uuid = z.uuid('Identificador inválido');

export const idParam = z.object({ id: uuid });
export type IdParam = z.infer<typeof idParam>;

/** Booleano em query string: "true"/"false"/"1"/"0"/"sim"/"nao". */
export const booleanoQuery = z.stringbool({
  truthy: ['true', '1', 'sim', 's', 'yes', 'on'],
  falsy: ['false', '0', 'nao', 'não', 'n', 'no', 'off'],
});

/** Texto curto obrigatório, já sem espaços nas pontas. */
export const textoCurto = z
  .string()
  .trim()
  .min(1, 'Campo obrigatório')
  .max(160, 'Máximo de 160 caracteres');

/** Texto opcional (observações etc.); string vazia vira undefined. */
export const textoOpcional = z
  .string()
  .trim()
  .max(2000, 'Máximo de 2000 caracteres')
  .optional()
  .transform((v) => (v === '' ? undefined : v));

/** Texto opcional que aceita null explícito (PATCH limpa o campo). */
export const textoNulavel = z
  .string()
  .trim()
  .max(2000, 'Máximo de 2000 caracteres')
  .nullable()
  .optional()
  .transform((v) => (v === '' ? null : v));

/** Cor em hexadecimal (#rrggbb). */
export const corHex = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Cor deve estar no formato #rrggbb')
  .transform((v) => v.toLowerCase());

/** Telefone brasileiro: só dígitos, 10 ou 11 (com DDD). Aceita máscara na entrada. */
export const telefone = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ''))
  .pipe(z.string().regex(/^\d{10,11}$/, 'Telefone deve ter DDD + 8 ou 9 dígitos'));

/** CEP: 8 dígitos, aceita máscara. */
export const cep = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ''))
  .pipe(z.string().regex(/^\d{8}$/, 'CEP deve ter 8 dígitos'));

export const uf = z.enum(UFS, { error: 'UF inválida' });

/** E-mail opcional normalizado. */
export const emailOpcional = z
  .email('E-mail inválido')
  .max(160)
  .transform((v) => v.trim().toLowerCase())
  .optional();

/** Endereço estruturado (contatos e dados do MEI). */
export const endereco = z.object({
  logradouro: z.string().trim().max(160).optional(),
  numero: z.string().trim().max(20).optional(),
  complemento: z.string().trim().max(60).optional(),
  bairro: z.string().trim().max(80).optional(),
  cidade: z.string().trim().max(80).optional(),
  uf: uf.optional(),
  cep: cep.optional(),
});
export type Endereco = z.infer<typeof endereco>;

export const enderecoDto = z.object({
  logradouro: z.string().nullable(),
  numero: z.string().nullable(),
  complemento: z.string().nullable(),
  bairro: z.string().nullable(),
  cidade: z.string().nullable(),
  uf: z.string().nullable(),
  cep: z.string().nullable(),
});
export type EnderecoDto = z.infer<typeof enderecoDto>;

/** Carimbo de data/hora ISO 8601 (createdAt/updatedAt). */
export const timestamp = z.string();

/** Documento (CPF/CNPJ) normalizado: só dígitos/letras, maiúsculas. A validação de dígitos fica em domain/documentos. */
export const documentoInput = z
  .string()
  .trim()
  .transform((v) => v.replace(/[.\-/\s]/g, '').toUpperCase())
  .pipe(
    z
      .string()
      .regex(
        /^(\d{11}|[A-Z0-9]{12}\d{2})$/,
        'Documento deve ser um CPF (11 dígitos) ou CNPJ (14 caracteres)',
      ),
  );

// ---------------------------------------------------------------------------
// Paginação, período e ordenação
// ---------------------------------------------------------------------------

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1, 'Página deve ser ≥ 1').default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1, 'Tamanho de página deve ser ≥ 1')
    .max(PAGINACAO.pageSizeMax, `Tamanho de página máximo é ${PAGINACAO.pageSizeMax}`)
    .default(PAGINACAO.pageSizePadrao),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;

/** Alias em pt-BR de paginationQuery. */
export const paginacaoQuery = paginationQuery;

export const ordemQuery = z.enum(['asc', 'desc']).default('desc');
export type Ordem = z.infer<typeof ordemQuery>;

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

/** Alias em pt-BR de paginatedResponse. */
export const paginado = paginatedResponse;

/** Envelope de item: { data: T } */
export function itemResponse<T extends z.ZodType>(item: T) {
  return z.object({ data: item });
}

/** Envelope de lista sem paginação: { data: T[] } */
export function listaResponse<T extends z.ZodType>(item: T) {
  return z.object({ data: z.array(item) });
}

/** Resposta de operações sem corpo relevante (DELETE etc.). */
export const okResponse = z.object({ data: z.object({ ok: z.literal(true) }) });
export type OkResponse = z.infer<typeof okResponse>;

/** Período obrigatório {de, ate} com de ≤ ate. */
export const periodoQuery = z
  .object({
    de: isoDate,
    ate: isoDate,
  })
  .refine((p) => p.de <= p.ate, {
    message: 'Data inicial deve ser anterior ou igual à final',
    path: ['ate'],
  });
export type PeriodoQuery = z.infer<typeof periodoQuery>;

/** Período opcional (filtros de lista). */
export const periodoOpcionalQuery = z
  .object({
    de: isoDate.optional(),
    ate: isoDate.optional(),
  })
  .refine((p) => !p.de || !p.ate || p.de <= p.ate, {
    message: 'Data inicial deve ser anterior ou igual à final',
    path: ['ate'],
  });
export type PeriodoOpcionalQuery = z.infer<typeof periodoOpcionalQuery>;

/** Campos de período reutilizáveis dentro de outros objetos (sem o refine). */
export const periodoCampos = {
  de: isoDate.optional(),
  ate: isoDate.optional(),
};

export const periodoDto = z.object({ de: isoDate, ate: isoDate });
export type PeriodoDto = z.infer<typeof periodoDto>;

export function refinarPeriodo<T extends { de?: string | undefined; ate?: string | undefined }>(
  schema: z.ZodType<T>,
) {
  return schema.refine((p) => !p.de || !p.ate || p.de <= p.ate, {
    message: 'Data inicial deve ser anterior ou igual à final',
    path: ['ate'],
  });
}

// ---------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------

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

/** Referências resumidas embutidas em DTOs (categoria/contato de um lançamento etc.). */
export const categoriaRef = z.object({
  id: uuid,
  nome: z.string(),
  cor: z.string().nullable(),
  icone: z.string().nullable(),
});
export type CategoriaRef = z.infer<typeof categoriaRef>;

export const contatoRef = z.object({
  id: uuid,
  nome: z.string(),
  tipo: z.string(),
});
export type ContatoRef = z.infer<typeof contatoRef>;
