// Contratos do módulo "relatorios" (seção 4 do plano): dre, extrato, dasn, limite, lancamentos (csv), contas.
// Todos aceitam ?formato=json|csv|pdf; os DTOs abaixo descrevem o formato json.
import { z } from 'zod';

import {
  FORMAS_PAGAMENTO,
  FORMATOS_RELATORIO,
  GRUPOS_DASN,
  ORIGENS_LANCAMENTO,
  REGIMES_APURACAO,
  STATUS_LANCAMENTO,
  STATUS_PARCELA,
  TIPOS_LANCAMENTO,
  TIPOS_TITULO,
} from '../constants.js';
import type { Dre } from '../domain/dre.js';
import {
  ano,
  booleanoQuery,
  centavos,
  competencia,
  isoDate,
  itemResponse,
  ordemQuery,
  periodoDto,
  periodoQuery,
  refinarPeriodo,
  uuid,
} from './common.js';
import { ORDENACAO_LANCAMENTOS } from './lancamentos.js';
import { dasnDto, limiteDto } from './obrigacoes.js';

export const formatoQuery = z.object({
  formato: z.enum(FORMATOS_RELATORIO).default('json'),
});
export type FormatoQuery = z.infer<typeof formatoQuery>;

// ---------------------------------------------------------------------------
// DRE simplificada
// ---------------------------------------------------------------------------

export const dreQuery = periodoQuery.safeExtend({
  formato: formatoQuery.shape.formato,
  /** Padrão: regime das configurações. */
  regime: z.enum(REGIMES_APURACAO).optional(),
});
export type DreQuery = z.infer<typeof dreQuery>;

export const linhaDreDto = z.object({
  categoriaId: uuid.nullable(),
  nome: z.string(),
  grupoDasn: z.enum(GRUPOS_DASN).nullable(),
  valor: centavos,
  /** Participação no total do grupo (receitas ou despesas), 0-100. */
  percentual: z.number(),
  quantidade: z.number().int(),
});
export type LinhaDreDto = z.infer<typeof linhaDreDto>;

export const dreDto = z.object({
  receitas: z.object({ total: centavos, itens: z.array(linhaDreDto) }),
  despesas: z.object({ total: centavos, itens: z.array(linhaDreDto) }),
  /** Impostos (categoria de sistema "Impostos e DAS"), já incluídos nas despesas. */
  impostos: centavos,
  resultado: centavos,
  /** Margem: resultado / receitas (0-100); null sem receitas. */
  margem: z.number().nullable(),
}) satisfies z.ZodType<Dre>;
export type DreDto = z.infer<typeof dreDto>;

export const dreRelatorioDto = dreDto.extend({
  periodo: periodoDto,
  regime: z.enum(REGIMES_APURACAO),
  geradoEm: z.string(),
});
export type DreRelatorioDto = z.infer<typeof dreRelatorioDto>;

export const dreResponse = itemResponse(dreRelatorioDto);
export type DreResponse = z.infer<typeof dreResponse>;

// ---------------------------------------------------------------------------
// Extrato
// ---------------------------------------------------------------------------

export const extratoQuery = periodoQuery.safeExtend({
  formato: formatoQuery.shape.formato,
  tipo: z.enum(TIPOS_LANCAMENTO).optional(),
  categoriaId: uuid.optional(),
  contatoId: uuid.optional(),
  /** Padrão true: só pagos (com saldo corrido). */
  somentePagos: booleanoQuery.default(true),
});
export type ExtratoQuery = z.infer<typeof extratoQuery>;

export const linhaExtratoDto = z.object({
  id: uuid,
  data: isoDate,
  descricao: z.string(),
  tipo: z.enum(TIPOS_LANCAMENTO),
  categoria: z.string().nullable(),
  contato: z.string().nullable(),
  formaPagamento: z.enum(FORMAS_PAGAMENTO).nullable(),
  status: z.enum(STATUS_LANCAMENTO),
  origem: z.enum(ORIGENS_LANCAMENTO),
  valor: centavos,
  /** Saldo corrido após a linha. */
  saldo: centavos,
});
export type LinhaExtratoDto = z.infer<typeof linhaExtratoDto>;

export const extratoDto = z.object({
  periodo: periodoDto,
  saldoInicial: centavos,
  linhas: z.array(linhaExtratoDto),
  totais: z.object({ receitas: centavos, despesas: centavos, saldoFinal: centavos }),
  geradoEm: z.string(),
});
export type ExtratoDto = z.infer<typeof extratoDto>;

export const extratoResponse = itemResponse(extratoDto);
export type ExtratoResponse = z.infer<typeof extratoResponse>;

// ---------------------------------------------------------------------------
// DASN (relatório anual de faturamento)
// ---------------------------------------------------------------------------

export const dasnRelatorioQuery = z.object({
  ano: ano.optional(),
  formato: formatoQuery.shape.formato,
});
export type DasnRelatorioQuery = z.infer<typeof dasnRelatorioQuery>;

export const dasnRelatorioDto = dasnDto.extend({
  porMes: z.array(
    z.object({
      competencia,
      comercio: centavos,
      servicos: centavos,
      semGrupo: centavos,
      total: centavos,
      dasPago: z.boolean(),
    }),
  ),
  geradoEm: z.string(),
});
export type DasnRelatorioDto = z.infer<typeof dasnRelatorioDto>;

export const dasnRelatorioResponse = itemResponse(dasnRelatorioDto);
export type DasnRelatorioResponse = z.infer<typeof dasnRelatorioResponse>;

// ---------------------------------------------------------------------------
// Limite (faturamento x limite)
// ---------------------------------------------------------------------------

export const limiteRelatorioQuery = dasnRelatorioQuery;
export type LimiteRelatorioQuery = z.infer<typeof limiteRelatorioQuery>;

export const limiteRelatorioDto = limiteDto.extend({ geradoEm: z.string() });
export type LimiteRelatorioDto = z.infer<typeof limiteRelatorioDto>;

export const limiteRelatorioResponse = itemResponse(limiteRelatorioDto);
export type LimiteRelatorioResponse = z.infer<typeof limiteRelatorioResponse>;

// ---------------------------------------------------------------------------
// Lançamentos (exportação, sem paginação)
// ---------------------------------------------------------------------------

export const lancamentosRelatorioQuery = refinarPeriodo(
  z.object({
    de: isoDate.optional(),
    ate: isoDate.optional(),
    formato: z.enum(FORMATOS_RELATORIO).default('csv'),
    tipo: z.enum(TIPOS_LANCAMENTO).optional(),
    status: z.enum(STATUS_LANCAMENTO).optional(),
    categoriaId: uuid.optional(),
    contatoId: uuid.optional(),
    formaPagamento: z.enum(FORMAS_PAGAMENTO).optional(),
    origem: z.enum(ORIGENS_LANCAMENTO).optional(),
    busca: z.string().trim().max(80).optional(),
    ordenarPor: z.enum(ORDENACAO_LANCAMENTOS).default('data'),
    ordem: ordemQuery.default('asc'),
  }),
);
export type LancamentosRelatorioQuery = z.infer<typeof lancamentosRelatorioQuery>;

/** Colunas do CSV de lançamentos (ordem fixa; títulos em pt-BR). */
export const COLUNAS_CSV_LANCAMENTOS = [
  'data',
  'tipo',
  'descricao',
  'valor',
  'categoria',
  'contato',
  'formaPagamento',
  'status',
  'dataPagamento',
  'origem',
  'observacoes',
] as const;
export type ColunaCsvLancamentos = (typeof COLUNAS_CSV_LANCAMENTOS)[number];

export const TITULOS_CSV_LANCAMENTOS: Record<ColunaCsvLancamentos, string> = {
  data: 'Data',
  tipo: 'Tipo',
  descricao: 'Descrição',
  valor: 'Valor',
  categoria: 'Categoria',
  contato: 'Cliente/Fornecedor',
  formaPagamento: 'Forma de pagamento',
  status: 'Status',
  dataPagamento: 'Data de pagamento',
  origem: 'Origem',
  observacoes: 'Observações',
};

// ---------------------------------------------------------------------------
// Contas (parcelas a pagar/receber)
// ---------------------------------------------------------------------------

export const contasRelatorioQuery = z
  .object({
    formato: formatoQuery.shape.formato,
    tipo: z.enum(TIPOS_TITULO).optional(),
    status: z.enum(STATUS_PARCELA).optional(),
    contatoId: uuid.optional(),
    vencimentoDe: isoDate.optional(),
    vencimentoAte: isoDate.optional(),
    atrasadas: booleanoQuery.optional(),
  })
  .refine((q) => !q.vencimentoDe || !q.vencimentoAte || q.vencimentoDe <= q.vencimentoAte, {
    message: 'Data inicial deve ser anterior ou igual à final',
    path: ['vencimentoAte'],
  });
export type ContasRelatorioQuery = z.infer<typeof contasRelatorioQuery>;

export const linhaContasDto = z.object({
  parcelaId: uuid,
  tituloId: uuid,
  tipo: z.enum(TIPOS_TITULO),
  descricao: z.string(),
  contato: z.string().nullable(),
  categoria: z.string().nullable(),
  parcela: z.string(),
  vencimento: isoDate,
  valor: centavos,
  status: z.enum(STATUS_PARCELA),
  dataPagamento: isoDate.nullable(),
  valorPago: centavos.nullable(),
  atrasada: z.boolean(),
  diasAtraso: z.number().int(),
});
export type LinhaContasDto = z.infer<typeof linhaContasDto>;

export const contasRelatorioDto = z.object({
  filtros: z.object({
    tipo: z.enum(TIPOS_TITULO).nullable(),
    status: z.enum(STATUS_PARCELA).nullable(),
    vencimentoDe: isoDate.nullable(),
    vencimentoAte: isoDate.nullable(),
  }),
  linhas: z.array(linhaContasDto),
  totais: z.object({
    pagar: z.object({ aberto: centavos, atrasado: centavos, pago: centavos }),
    receber: z.object({ aberto: centavos, atrasado: centavos, pago: centavos }),
  }),
  geradoEm: z.string(),
});
export type ContasRelatorioDto = z.infer<typeof contasRelatorioDto>;

export const contasRelatorioResponse = itemResponse(contasRelatorioDto);
export type ContasRelatorioResponse = z.infer<typeof contasRelatorioResponse>;
