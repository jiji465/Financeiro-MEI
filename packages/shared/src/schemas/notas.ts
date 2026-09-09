// Contratos do módulo "notas-fiscais" (seção 4 do plano): CRUD, gerarReceita, cancelar, arquivo, vincular, resumo.
import { z } from 'zod';

import { PROVEDORES_NOTA, STATUS_NOTA, TIPOS_NOTA } from '../constants.js';
import {
  anoQuery,
  centavos,
  centavosPositivo,
  competencia,
  contatoRef,
  isoDate,
  itemResponse,
  ordemQuery,
  paginatedResponse,
  paginationQuery,
  refinarPeriodo,
  textoNulavel,
  timestamp,
  uuid,
} from './common.js';
import { anexoDto, lancamentoDto } from './lancamentos.js';

export const notaFiscalDto = z.object({
  id: uuid,
  tipo: z.enum(TIPOS_NOTA),
  numero: z.string(),
  serie: z.string().nullable(),
  dataEmissao: isoDate,
  contatoId: uuid.nullable(),
  contato: contatoRef.nullable(),
  valor: centavosPositivo,
  descricao: z.string().nullable(),
  status: z.enum(STATUS_NOTA),
  dataCancelamento: isoDate.nullable(),
  motivoCancelamento: z.string().nullable(),
  lancamentoId: uuid.nullable(),
  linkExterno: z.string().nullable(),
  arquivo: anexoDto.nullable(),
  provedor: z.enum(PROVEDORES_NOTA),
  chaveAcesso: z.string().nullable(),
  protocolo: z.string().nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type NotaFiscalDto = z.infer<typeof notaFiscalDto>;

const numeroNota = z
  .string()
  .trim()
  .min(1, 'Informe o número da nota')
  .max(20, 'Número deve ter no máximo 20 caracteres');

const notaCampos = z.object({
  tipo: z.enum(TIPOS_NOTA, { error: 'Tipo deve ser NF-e, NFS-e ou NFC-e' }),
  numero: numeroNota,
  serie: z.string().trim().max(10).nullable().optional(),
  dataEmissao: isoDate,
  contatoId: uuid.nullable().optional(),
  valor: centavosPositivo,
  descricao: textoNulavel,
  linkExterno: z.url('Link inválido').max(500).nullable().optional(),
  chaveAcesso: z
    .string()
    .trim()
    .regex(/^\d{44}$/, 'Chave de acesso deve ter 44 dígitos')
    .nullable()
    .optional(),
});

export const criarNotaFiscalBody = notaCampos
  .extend({
    /** Cria a receita correspondente (origem nota_fiscal). Exige categoriaId. */
    gerarReceita: z.boolean().default(false),
    categoriaId: uuid.optional(),
    /** Vincula a uma receita já existente (exclusivo com gerarReceita). */
    lancamentoId: uuid.optional(),
  })
  .superRefine((n, ctx) => {
    if (n.gerarReceita && !n.categoriaId) {
      ctx.addIssue({
        code: 'custom',
        path: ['categoriaId'],
        message: 'Informe a categoria da receita a ser gerada',
      });
    }
    if (n.gerarReceita && n.lancamentoId) {
      ctx.addIssue({
        code: 'custom',
        path: ['lancamentoId'],
        message: 'Não é possível gerar receita e vincular um lançamento ao mesmo tempo',
      });
    }
  });
export type CriarNotaFiscalBody = z.infer<typeof criarNotaFiscalBody>;

export const atualizarNotaFiscalBody = notaCampos.partial();
export type AtualizarNotaFiscalBody = z.infer<typeof atualizarNotaFiscalBody>;

/** POST /notas-fiscais/:id/cancelar */
export const cancelarNotaFiscalBody = z.object({
  dataCancelamento: isoDate.optional(),
  motivoCancelamento: z
    .string()
    .trim()
    .min(3, 'Informe o motivo do cancelamento')
    .max(255, 'Motivo deve ter no máximo 255 caracteres'),
  /** Exclui a receita vinculada (se houver e não estiver conciliada). */
  estornarReceita: z.boolean().default(false),
});
export type CancelarNotaFiscalBody = z.infer<typeof cancelarNotaFiscalBody>;

/** POST /notas-fiscais/:id/vincular */
export const vincularNotaFiscalBody = z.object({
  /** null desvincula. */
  lancamentoId: uuid.nullable(),
});
export type VincularNotaFiscalBody = z.infer<typeof vincularNotaFiscalBody>;

export const ORDENACAO_NOTAS = ['dataEmissao', 'numero', 'valor', 'createdAt'] as const;

export const listarNotasFiscaisQuery = refinarPeriodo(
  paginationQuery.extend({
    tipo: z.enum(TIPOS_NOTA).optional(),
    status: z.enum(STATUS_NOTA).optional(),
    contatoId: uuid.optional(),
    de: isoDate.optional(),
    ate: isoDate.optional(),
    busca: z.string().trim().max(80).optional(),
    /** Só notas sem lançamento vinculado. */
    semLancamento: z.stringbool().optional(),
    ordenarPor: z.enum(ORDENACAO_NOTAS).default('dataEmissao'),
    ordem: ordemQuery,
  }),
);
export type ListarNotasFiscaisQuery = z.infer<typeof listarNotasFiscaisQuery>;

export const resumoNotasFiscaisQuery = anoQuery;
export type ResumoNotasFiscaisQuery = z.infer<typeof resumoNotasFiscaisQuery>;

const grupoNotas = z.object({ quantidade: z.number().int(), valor: centavos });

export const resumoNotasFiscaisDto = z.object({
  ano: z.number().int(),
  emitidas: grupoNotas,
  canceladas: grupoNotas,
  porTipo: z.array(grupoNotas.extend({ tipo: z.enum(TIPOS_NOTA) })),
  porMes: z.array(grupoNotas.extend({ competencia })),
  /** Notas emitidas sem lançamento vinculado. */
  semLancamento: grupoNotas,
});
export type ResumoNotasFiscaisDto = z.infer<typeof resumoNotasFiscaisDto>;

export const notaFiscalResponse = itemResponse(notaFiscalDto);
export type NotaFiscalResponse = z.infer<typeof notaFiscalResponse>;

export const listaNotasFiscaisResponse = paginatedResponse(notaFiscalDto).extend({
  totais: z.object({ valor: centavos, quantidade: z.number().int() }),
});
export type ListaNotasFiscaisResponse = z.infer<typeof listaNotasFiscaisResponse>;

/** POST com gerarReceita devolve também o lançamento criado. */
export const criarNotaFiscalResponse = itemResponse(
  z.object({ nota: notaFiscalDto, lancamento: lancamentoDto.nullable() }),
);
export type CriarNotaFiscalResponse = z.infer<typeof criarNotaFiscalResponse>;

export const resumoNotasFiscaisResponse = itemResponse(resumoNotasFiscaisDto);
export type ResumoNotasFiscaisResponse = z.infer<typeof resumoNotasFiscaisResponse>;

export const arquivoNotaResponse = itemResponse(anexoDto);
export type ArquivoNotaResponse = z.infer<typeof arquivoNotaResponse>;
