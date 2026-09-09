// Contratos do módulo "lancamentos" (seção 4 do plano): lançamentos, recorrências, anexo, resumo e filtros.
import { z } from 'zod';

import {
  ANEXO,
  FORMAS_PAGAMENTO,
  ORIGENS_LANCAMENTO,
  STATUS_LANCAMENTO,
  TIPOS_LANCAMENTO,
} from '../constants.js';
import {
  categoriaRef,
  centavos,
  centavosPositivo,
  competencia,
  contatoRef,
  isoDate,
  itemResponse,
  listaResponse,
  ordemQuery,
  paginatedResponse,
  paginationQuery,
  periodoCampos,
  periodoDto,
  periodoQuery,
  refinarPeriodo,
  textoNulavel,
  timestamp,
  uuid,
} from './common.js';

// ---------------------------------------------------------------------------
// Anexo
// ---------------------------------------------------------------------------

export const anexoDto = z.object({
  nome: z.string(),
  mime: z.string(),
  tamanho: z.number().int(),
});
export type AnexoDto = z.infer<typeof anexoDto>;

/** Metadados validados do upload (multipart) antes de gravar. */
export const anexoUploadMeta = z.object({
  nome: z.string().trim().min(1, 'Nome do arquivo obrigatório').max(200),
  mime: z.enum(ANEXO.mimesPermitidos, {
    error: 'Formato não permitido: envie PDF, JPG, PNG ou XML',
  }),
  tamanho: z
    .number()
    .int()
    .positive('Arquivo vazio')
    .max(ANEXO.tamanhoMaxBytes, 'Arquivo deve ter no máximo 10 MB'),
});
export type AnexoUploadMeta = z.infer<typeof anexoUploadMeta>;

export const anexoResponse = itemResponse(anexoDto);
export type AnexoResponse = z.infer<typeof anexoResponse>;

// ---------------------------------------------------------------------------
// Lançamento
// ---------------------------------------------------------------------------

export const lancamentoDto = z.object({
  id: uuid,
  tipo: z.enum(TIPOS_LANCAMENTO),
  data: isoDate,
  valor: centavosPositivo,
  descricao: z.string(),
  categoriaId: uuid,
  categoria: categoriaRef.nullable(),
  contatoId: uuid.nullable(),
  contato: contatoRef.nullable(),
  formaPagamento: z.enum(FORMAS_PAGAMENTO).nullable(),
  status: z.enum(STATUS_LANCAMENTO),
  dataPagamento: isoDate.nullable(),
  observacoes: z.string().nullable(),
  anexo: anexoDto.nullable(),
  origem: z.enum(ORIGENS_LANCAMENTO),
  recorrenciaId: uuid.nullable(),
  competencia: competencia.nullable(),
  parcelaId: uuid.nullable(),
  importacaoId: uuid.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type LancamentoDto = z.infer<typeof lancamentoDto>;

const descricaoLancamento = z
  .string()
  .trim()
  .min(1, 'Informe a descrição')
  .max(160, 'Descrição deve ter no máximo 160 caracteres');

/** Recorrência opcional embutida no POST /lancamentos. */
export const recorrenciaInput = z.object({
  diaDoMes: z
    .number()
    .int('Dia inválido')
    .min(1, 'Dia deve ser entre 1 e 31')
    .max(31, 'Dia deve ser entre 1 e 31'),
  dataFim: isoDate.nullable().optional(),
});
export type RecorrenciaInput = z.infer<typeof recorrenciaInput>;

const lancamentoCampos = z.object({
  tipo: z.enum(TIPOS_LANCAMENTO, { error: 'Tipo deve ser receita ou despesa' }),
  data: isoDate,
  valor: centavosPositivo,
  descricao: descricaoLancamento,
  categoriaId: uuid,
  contatoId: uuid.nullable().optional(),
  formaPagamento: z
    .enum(FORMAS_PAGAMENTO, { error: 'Forma de pagamento inválida' })
    .nullable()
    .optional(),
  status: z.enum(STATUS_LANCAMENTO).default('pago'),
  dataPagamento: isoDate.nullable().optional(),
  observacoes: textoNulavel,
});

function validarPagamento(
  v: {
    status?: string | undefined;
    dataPagamento?: string | null | undefined;
    data?: string | undefined;
  },
  ctx: z.RefinementCtx,
) {
  if (v.status === 'pendente' && v.dataPagamento) {
    ctx.addIssue({
      code: 'custom',
      path: ['dataPagamento'],
      message: 'Lançamento pendente não pode ter data de pagamento',
    });
  }
}

export const criarLancamentoBody = lancamentoCampos
  .extend({ recorrencia: recorrenciaInput.optional() })
  .superRefine((v, ctx) => {
    validarPagamento(v, ctx);
    if (v.recorrencia?.dataFim && v.recorrencia.dataFim < v.data) {
      ctx.addIssue({
        code: 'custom',
        path: ['recorrencia', 'dataFim'],
        message: 'Data final da recorrência deve ser posterior à data do lançamento',
      });
    }
  });
export type CriarLancamentoBody = z.infer<typeof criarLancamentoBody>;

/** PATCH /lancamentos/:id. Para origem das/baixa a API só aceita descricao/observacoes (422 no resto). */
export const atualizarLancamentoBody = lancamentoCampos
  .omit({ status: true })
  .extend({ status: z.enum(STATUS_LANCAMENTO).optional() })
  .partial()
  .superRefine(validarPagamento);
export type AtualizarLancamentoBody = z.infer<typeof atualizarLancamentoBody>;

/** POST /lancamentos/:id/pagar */
export const pagarLancamentoBody = z.object({
  dataPagamento: isoDate.optional(),
  formaPagamento: z.enum(FORMAS_PAGAMENTO).optional(),
});
export type PagarLancamentoBody = z.infer<typeof pagarLancamentoBody>;

export const ORDENACAO_LANCAMENTOS = ['data', 'valor', 'descricao', 'createdAt'] as const;
export type OrdenacaoLancamentos = (typeof ORDENACAO_LANCAMENTOS)[number];

export const listarLancamentosQuery = refinarPeriodo(
  paginationQuery.extend({
    ...periodoCampos,
    tipo: z.enum(TIPOS_LANCAMENTO).optional(),
    status: z.enum(STATUS_LANCAMENTO).optional(),
    categoriaId: uuid.optional(),
    contatoId: uuid.optional(),
    formaPagamento: z.enum(FORMAS_PAGAMENTO).optional(),
    origem: z.enum(ORIGENS_LANCAMENTO).optional(),
    busca: z.string().trim().max(80).optional(),
    ordenarPor: z.enum(ORDENACAO_LANCAMENTOS).default('data'),
    ordem: ordemQuery,
  }),
);
export type ListarLancamentosQuery = z.infer<typeof listarLancamentosQuery>;

export const lancamentoResponse = itemResponse(lancamentoDto);
export type LancamentoResponse = z.infer<typeof lancamentoResponse>;

export const listaLancamentosResponse = paginatedResponse(lancamentoDto).extend({
  /** Totais do filtro aplicado (não só da página). */
  totais: z.object({
    receitas: centavos,
    despesas: centavos,
    saldo: centavos,
  }),
});
export type ListaLancamentosResponse = z.infer<typeof listaLancamentosResponse>;

// ---------------------------------------------------------------------------
// Resumo
// ---------------------------------------------------------------------------

export const resumoLancamentosQuery = periodoQuery;
export type ResumoLancamentosQuery = z.infer<typeof resumoLancamentosQuery>;

const totalPorStatus = z.object({
  pagos: centavos,
  pendentes: centavos,
  total: centavos,
  quantidade: z.number().int(),
});

export const resumoLancamentosDto = z.object({
  periodo: periodoDto,
  receitas: totalPorStatus,
  despesas: totalPorStatus,
  /** receitas pagas − despesas pagas */
  saldo: centavos,
  /** considerando também os pendentes */
  saldoPrevisto: centavos,
});
export type ResumoLancamentosDto = z.infer<typeof resumoLancamentosDto>;

export const resumoLancamentosResponse = itemResponse(resumoLancamentosDto);
export type ResumoLancamentosResponse = z.infer<typeof resumoLancamentosResponse>;

// ---------------------------------------------------------------------------
// Recorrências
// ---------------------------------------------------------------------------

export const recorrenciaDto = z.object({
  id: uuid,
  tipo: z.enum(TIPOS_LANCAMENTO),
  valor: centavosPositivo,
  descricao: z.string(),
  categoriaId: uuid,
  categoria: categoriaRef.nullable(),
  contatoId: uuid.nullable(),
  contato: contatoRef.nullable(),
  formaPagamento: z.enum(FORMAS_PAGAMENTO).nullable(),
  diaDoMes: z.number().int(),
  dataInicio: isoDate,
  dataFim: isoDate.nullable(),
  ativo: z.boolean(),
  ultimaCompetencia: competencia.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type RecorrenciaDto = z.infer<typeof recorrenciaDto>;

const recorrenciaCampos = z.object({
  tipo: z.enum(TIPOS_LANCAMENTO, { error: 'Tipo deve ser receita ou despesa' }),
  valor: centavosPositivo,
  descricao: descricaoLancamento,
  categoriaId: uuid,
  contatoId: uuid.nullable().optional(),
  formaPagamento: z.enum(FORMAS_PAGAMENTO).nullable().optional(),
  diaDoMes: recorrenciaInput.shape.diaDoMes,
  dataInicio: isoDate,
  dataFim: isoDate.nullable().optional(),
});

const fimAposInicio = {
  message: 'Data final deve ser posterior à data inicial',
  path: ['dataFim'],
};

export const criarRecorrenciaBody = recorrenciaCampos.refine(
  (r) => !r.dataFim || r.dataFim >= r.dataInicio,
  fimAposInicio,
);
export type CriarRecorrenciaBody = z.infer<typeof criarRecorrenciaBody>;

export const atualizarRecorrenciaBody = recorrenciaCampos
  .partial()
  .extend({ ativo: z.boolean().optional() })
  .refine((r) => !r.dataFim || !r.dataInicio || r.dataFim >= r.dataInicio, fimAposInicio);
export type AtualizarRecorrenciaBody = z.infer<typeof atualizarRecorrenciaBody>;

export const listarRecorrenciasQuery = z.object({
  tipo: z.enum(TIPOS_LANCAMENTO).optional(),
  ativo: z.stringbool().optional(),
});
export type ListarRecorrenciasQuery = z.infer<typeof listarRecorrenciasQuery>;

export const recorrenciaResponse = itemResponse(recorrenciaDto);
export type RecorrenciaResponse = z.infer<typeof recorrenciaResponse>;

export const listaRecorrenciasResponse = listaResponse(recorrenciaDto);
export type ListaRecorrenciasResponse = z.infer<typeof listaRecorrenciasResponse>;

/** POST /recorrencias/gerar (idempotente): materializa competências pendentes até o mês atual. */
export const gerarRecorrenciasBody = z.object({
  /** Limita a uma recorrência; omitido = todas ativas do tenant. */
  recorrenciaId: uuid.optional(),
  /** Competência limite (padrão: mês atual em America/Sao_Paulo). */
  ate: competencia.optional(),
});
export type GerarRecorrenciasBody = z.infer<typeof gerarRecorrenciasBody>;

export const gerarRecorrenciasResponse = itemResponse(
  z.object({
    geradas: z.number().int(),
    recorrencias: z.number().int(),
    competencias: z.array(competencia),
  }),
);
export type GerarRecorrenciasResponse = z.infer<typeof gerarRecorrenciasResponse>;
