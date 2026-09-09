// Contratos do módulo "titulos" (seção 4 do plano): títulos (contas a pagar/receber), parcelas, baixa/estorno e resumo.
import { z } from 'zod';

import { FORMAS_PAGAMENTO, STATUS_PARCELA, STATUS_TITULO, TIPOS_TITULO } from '../constants.js';
import {
  booleanoQuery,
  categoriaRef,
  centavos,
  centavosPositivo,
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
import { lancamentoDto } from './lancamentos.js';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export const tituloRef = z.object({
  id: uuid,
  tipo: z.enum(TIPOS_TITULO),
  descricao: z.string(),
  contatoId: uuid.nullable(),
  contato: contatoRef.nullable(),
  categoriaId: uuid,
  numeroParcelas: z.number().int(),
});
export type TituloRef = z.infer<typeof tituloRef>;

export const parcelaDto = z.object({
  id: uuid,
  tituloId: uuid,
  numero: z.number().int(),
  vencimento: isoDate,
  valor: centavosPositivo,
  status: z.enum(STATUS_PARCELA),
  lancamentoId: uuid.nullable(),
  dataPagamento: isoDate.nullable(),
  valorPago: centavos.nullable(),
  formaPagamento: z.enum(FORMAS_PAGAMENTO).nullable(),
  /** Calculados com "hoje" em America/Sao_Paulo. */
  atrasada: z.boolean(),
  diasAtraso: z.number().int(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type ParcelaDto = z.infer<typeof parcelaDto>;

/** Parcela com o título embutido (listagem de contas). */
export const parcelaComTituloDto = parcelaDto.extend({ titulo: tituloRef });
export type ParcelaComTituloDto = z.infer<typeof parcelaComTituloDto>;

export const tituloDto = z.object({
  id: uuid,
  tipo: z.enum(TIPOS_TITULO),
  descricao: z.string(),
  contatoId: uuid.nullable(),
  contato: contatoRef.nullable(),
  categoriaId: uuid,
  categoria: categoriaRef.nullable(),
  valorTotal: centavosPositivo,
  numeroParcelas: z.number().int(),
  dataEmissao: isoDate,
  notaFiscalId: uuid.nullable(),
  status: z.enum(STATUS_TITULO),
  observacoes: z.string().nullable(),
  valorPago: centavos,
  valorAberto: centavos,
  parcelas: z.array(parcelaDto),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type TituloDto = z.infer<typeof tituloDto>;

// ---------------------------------------------------------------------------
// Criação / edição
// ---------------------------------------------------------------------------

export const PARCELAS_MAX = 120;

/** Parcelamento automático: n parcelas mensais a partir do primeiro vencimento. */
export const parcelasPorQuantidade = z.object({
  quantidade: z
    .number()
    .int('Quantidade inválida')
    .min(1, 'Mínimo de 1 parcela')
    .max(PARCELAS_MAX, `Máximo de ${PARCELAS_MAX} parcelas`),
  primeiroVencimento: isoDate,
});
export type ParcelasPorQuantidade = z.infer<typeof parcelasPorQuantidade>;

export const parcelaInput = z.object({
  vencimento: isoDate,
  valor: centavosPositivo,
});
export type ParcelaInput = z.infer<typeof parcelaInput>;

/** Parcelamento manual: lista explícita (Σ valor deve ser igual a valorTotal). */
export const parcelasPorLista = z.object({
  lista: z
    .array(parcelaInput)
    .min(1, 'Informe pelo menos uma parcela')
    .max(PARCELAS_MAX, `Máximo de ${PARCELAS_MAX} parcelas`),
});
export type ParcelasPorLista = z.infer<typeof parcelasPorLista>;

export const parcelasInput = z.union([parcelasPorQuantidade, parcelasPorLista], {
  error: 'Informe { quantidade, primeiroVencimento } ou { lista }',
});
export type ParcelasInput = z.infer<typeof parcelasInput>;

export function ehParcelasPorLista(p: ParcelasInput): p is ParcelasPorLista {
  return 'lista' in p;
}

const tituloCampos = z.object({
  tipo: z.enum(TIPOS_TITULO, { error: 'Tipo deve ser pagar ou receber' }),
  descricao: z
    .string()
    .trim()
    .min(1, 'Informe a descrição')
    .max(160, 'Descrição deve ter no máximo 160 caracteres'),
  contatoId: uuid.nullable().optional(),
  categoriaId: uuid,
  valorTotal: centavosPositivo,
  dataEmissao: isoDate.optional(),
  notaFiscalId: uuid.nullable().optional(),
  observacoes: textoNulavel,
});

export const criarTituloBody = tituloCampos
  .extend({ parcelas: parcelasInput })
  .superRefine((t, ctx) => {
    if (!ehParcelasPorLista(t.parcelas)) return;
    const soma = t.parcelas.lista.reduce((acc, p) => acc + p.valor, 0);
    if (soma !== t.valorTotal) {
      ctx.addIssue({
        code: 'custom',
        path: ['parcelas', 'lista'],
        message: 'A soma das parcelas deve ser igual ao valor total',
      });
    }
    const vencimentos = t.parcelas.lista.map((p) => p.vencimento);
    for (let i = 1; i < vencimentos.length; i++) {
      const anterior = vencimentos[i - 1];
      const atual = vencimentos[i];
      if (anterior !== undefined && atual !== undefined && atual < anterior) {
        ctx.addIssue({
          code: 'custom',
          path: ['parcelas', 'lista', i, 'vencimento'],
          message: 'Vencimentos devem estar em ordem crescente',
        });
        break;
      }
    }
  });
export type CriarTituloBody = z.infer<typeof criarTituloBody>;

/** PATCH /titulos/:id: só metadados; parcelas são editadas individualmente. */
export const atualizarTituloBody = tituloCampos
  .omit({ tipo: true, valorTotal: true })
  .partial()
  .extend({
    /** Só `cancelado` é aceito aqui (cancela as parcelas abertas); quitação é automática pelas baixas. */
    status: z.literal('cancelado').optional(),
  });
export type AtualizarTituloBody = z.infer<typeof atualizarTituloBody>;

/** PATCH /parcelas/:id (só parcelas abertas). */
export const atualizarParcelaBody = z
  .object({
    vencimento: isoDate.optional(),
    valor: centavosPositivo.optional(),
  })
  .refine((p) => p.vencimento !== undefined || p.valor !== undefined, {
    message: 'Informe vencimento ou valor',
  });
export type AtualizarParcelaBody = z.infer<typeof atualizarParcelaBody>;

/** POST /parcelas/:id/baixa → cria lançamento com origem "baixa". */
export const baixaParcelaBody = z.object({
  dataPagamento: isoDate.optional(),
  /** Padrão: valor da parcela. */
  valorPago: centavosPositivo.optional(),
  formaPagamento: z.enum(FORMAS_PAGAMENTO, { error: 'Forma de pagamento inválida' }).optional(),
  observacoes: textoNulavel,
});
export type BaixaParcelaBody = z.infer<typeof baixaParcelaBody>;

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export const ORDENACAO_TITULOS = ['dataEmissao', 'valorTotal', 'descricao', 'createdAt'] as const;

export const listarTitulosQuery = refinarPeriodo(
  paginationQuery.extend({
    tipo: z.enum(TIPOS_TITULO).optional(),
    status: z.enum(STATUS_TITULO).optional(),
    contatoId: uuid.optional(),
    categoriaId: uuid.optional(),
    /** Período pela data de emissão. */
    de: isoDate.optional(),
    ate: isoDate.optional(),
    busca: z.string().trim().max(80).optional(),
    ordenarPor: z.enum(ORDENACAO_TITULOS).default('dataEmissao'),
    ordem: ordemQuery,
  }),
);
export type ListarTitulosQuery = z.infer<typeof listarTitulosQuery>;

export const ORDENACAO_PARCELAS = ['vencimento', 'valor'] as const;

export const listarParcelasQuery = paginationQuery
  .extend({
    tipo: z.enum(TIPOS_TITULO).optional(),
    status: z.enum(STATUS_PARCELA).optional(),
    contatoId: uuid.optional(),
    vencimentoDe: isoDate.optional(),
    vencimentoAte: isoDate.optional(),
    /** Só parcelas abertas com vencimento < hoje. */
    atrasadas: booleanoQuery.optional(),
    busca: z.string().trim().max(80).optional(),
    ordenarPor: z.enum(ORDENACAO_PARCELAS).default('vencimento'),
    ordem: ordemQuery.default('asc'),
  })
  .refine((q) => !q.vencimentoDe || !q.vencimentoAte || q.vencimentoDe <= q.vencimentoAte, {
    message: 'Data inicial deve ser anterior ou igual à final',
    path: ['vencimentoAte'],
  });
export type ListarParcelasQuery = z.infer<typeof listarParcelasQuery>;

export const resumoParcelasQuery = z.object({
  dias: z.coerce.number().int().min(1).max(365).default(30),
});
export type ResumoParcelasQuery = z.infer<typeof resumoParcelasQuery>;

const grupoResumo = z.object({ quantidade: z.number().int(), valor: centavos });

const resumoPorTipo = z.object({
  atrasadas: grupoResumo,
  /** Vencem entre hoje e hoje + dias. */
  proximas: grupoResumo,
  /** Todas as abertas. */
  abertas: grupoResumo,
  /** Pagas nos últimos `dias`. */
  pagasNoPeriodo: grupoResumo,
});

export const resumoParcelasDto = z.object({
  dias: z.number().int(),
  pagar: resumoPorTipo,
  receber: resumoPorTipo,
});
export type ResumoParcelasDto = z.infer<typeof resumoParcelasDto>;

// ---------------------------------------------------------------------------
// Respostas
// ---------------------------------------------------------------------------

export const tituloResponse = itemResponse(tituloDto);
export type TituloResponse = z.infer<typeof tituloResponse>;

export const listaTitulosResponse = paginatedResponse(tituloDto);
export type ListaTitulosResponse = z.infer<typeof listaTitulosResponse>;

export const parcelaResponse = itemResponse(parcelaComTituloDto);
export type ParcelaResponse = z.infer<typeof parcelaResponse>;

export const listaParcelasResponse = paginatedResponse(parcelaComTituloDto).extend({
  totais: z.object({ valor: centavos, atrasado: centavos }),
});
export type ListaParcelasResponse = z.infer<typeof listaParcelasResponse>;

export const baixaParcelaResponse = itemResponse(
  z.object({
    parcela: parcelaComTituloDto,
    lancamento: lancamentoDto,
    titulo: tituloDto,
  }),
);
export type BaixaParcelaResponse = z.infer<typeof baixaParcelaResponse>;

export const resumoParcelasResponse = itemResponse(resumoParcelasDto);
export type ResumoParcelasResponse = z.infer<typeof resumoParcelasResponse>;
