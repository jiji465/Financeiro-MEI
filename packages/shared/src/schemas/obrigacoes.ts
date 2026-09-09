// Contratos do módulo "obrigacoes" (seção 4 do plano): parâmetros, DAS, DASN, limite, calendário e alertas.
// Os DTOs de DAS/limite/alertas espelham os tipos puros de domain/* (checado com `satisfies`).
import { z } from 'zod';

import {
  ATIVIDADES,
  CAMINHONEIRO_TRIBUTOS,
  FORMAS_PAGAMENTO,
  NIVEIS_LIMITE,
  SEVERIDADES_ALERTA,
  STATUS_DAS,
  STATUS_DASN,
  TIPOS_EXCESSO,
} from '../constants.js';
import type { Alerta } from '../domain/alertas.js';
import type { DetalhamentoDas, ParametrosMei } from '../domain/das.js';
import type { SituacaoLimite } from '../domain/limite.js';
import {
  anoQuery,
  centavos,
  centavosNaoNegativo,
  centavosPositivo,
  competencia,
  isoDate,
  itemResponse,
  listaResponse,
  okResponse,
  periodoQuery,
  textoNulavel,
  timestamp,
  uuid,
} from './common.js';
import { lancamentoDto } from './lancamentos.js';

// ---------------------------------------------------------------------------
// Parâmetros do MEI (tabela parametros_mei)
// ---------------------------------------------------------------------------

export const parametrosMeiDto = z.object({
  ano: z.number().int(),
  salarioMinimo: centavosPositivo,
  aliquotaInssBp: z.number().int(),
  aliquotaInssCaminhoneiroBp: z.number().int(),
  icms: centavosNaoNegativo,
  iss: centavosNaoNegativo,
  limiteAnual: centavosPositivo,
  limiteMensalProporcional: centavosPositivo,
  toleranciaExcessoBp: z.number().int(),
  diaVencimentoDas: z.number().int(),
  dasnPrazoDia: z.number().int(),
  dasnPrazoMes: z.number().int(),
  alertasLimitePct: z.array(z.number()),
}) satisfies z.ZodType<ParametrosMei>;
export type ParametrosMeiDto = z.infer<typeof parametrosMeiDto>;

export const parametrosQuery = anoQuery;
export type ParametrosQuery = z.infer<typeof parametrosQuery>;

/** GET /obrigacoes/parametros?ano → parâmetros do ano (ou do maior ano ≤ pedido, com desatualizado=true). */
export const parametrosResponse = itemResponse(
  z.object({
    anoSolicitado: z.number().int(),
    parametros: parametrosMeiDto,
    /** true quando não há linha para o ano pedido (usou o ano anterior mais próximo). */
    desatualizado: z.boolean(),
    /** Valores marcados para confirmação (ex.: seed 2025). */
    confirmar: z.boolean(),
    /** DAS calculado para o MEI logado com esses parâmetros. */
    dasMensal: z.object({
      inss: centavos,
      icms: centavos,
      iss: centavos,
      total: centavos,
      aliquotaInssBp: z.number().int(),
      salarioMinimo: centavos,
    }) satisfies z.ZodType<DetalhamentoDas>,
  }),
);
export type ParametrosResponse = z.infer<typeof parametrosResponse>;

// ---------------------------------------------------------------------------
// DAS mensal
// ---------------------------------------------------------------------------

export const detalhamentoDasDto = z.object({
  inss: centavos,
  icms: centavos,
  iss: centavos,
  total: centavos,
  aliquotaInssBp: z.number().int(),
  salarioMinimo: centavos,
}) satisfies z.ZodType<DetalhamentoDas>;
export type DetalhamentoDasDto = z.infer<typeof detalhamentoDasDto>;

export const dasPagamentoDto = z.object({
  id: uuid,
  competencia,
  valorCalculado: centavos,
  valorPago: centavos,
  dataPagamento: isoDate,
  formaPagamento: z.enum(FORMAS_PAGAMENTO).nullable(),
  lancamentoId: uuid.nullable(),
  observacao: z.string().nullable(),
  createdAt: timestamp,
});
export type DasPagamentoDto = z.infer<typeof dasPagamentoDto>;

export const dasCompetenciaDto = z.object({
  competencia,
  /** false para meses anteriores à abertura (não devidos). */
  devida: z.boolean(),
  valor: centavos,
  detalhamento: detalhamentoDasDto,
  /** Dia 20 do mês seguinte, empurrado para o próximo dia útil. */
  vencimento: isoDate,
  status: z.enum(STATUS_DAS),
  diasAtraso: z.number().int(),
  pagamento: dasPagamentoDto.nullable(),
});
export type DasCompetenciaDto = z.infer<typeof dasCompetenciaDto>;

export const dasAnoQuery = anoQuery;
export type DasAnoQuery = z.infer<typeof dasAnoQuery>;

export const dasAnoDto = z.object({
  ano: z.number().int(),
  atividade: z.enum(ATIVIDADES),
  caminhoneiroTributos: z.enum(CAMINHONEIRO_TRIBUTOS).nullable(),
  parametros: parametrosMeiDto,
  parametrosDesatualizados: z.boolean(),
  competencias: z.array(dasCompetenciaDto),
  totais: z.object({
    devido: centavos,
    pago: centavos,
    pendente: centavos,
    atrasado: centavos,
    quantidadeAtrasadas: z.number().int(),
  }),
});
export type DasAnoDto = z.infer<typeof dasAnoDto>;

export const dasAnoResponse = itemResponse(dasAnoDto);
export type DasAnoResponse = z.infer<typeof dasAnoResponse>;

export const competenciaParam = z.object({ competencia });
export type CompetenciaParam = z.infer<typeof competenciaParam>;

/** POST /obrigacoes/das/:competencia/pagamento → despesa com origem "das" na categoria configurada. */
export const registrarPagamentoDasBody = z.object({
  dataPagamento: isoDate.optional(),
  /** Padrão: valor calculado. Pode diferir (juros/multa em atraso). */
  valorPago: centavosPositivo.optional(),
  formaPagamento: z.enum(FORMAS_PAGAMENTO, { error: 'Forma de pagamento inválida' }).optional(),
  observacao: textoNulavel,
});
export type RegistrarPagamentoDasBody = z.infer<typeof registrarPagamentoDasBody>;

export const pagamentoDasResponse = itemResponse(
  z.object({ competencia: dasCompetenciaDto, lancamento: lancamentoDto }),
);
export type PagamentoDasResponse = z.infer<typeof pagamentoDasResponse>;

// ---------------------------------------------------------------------------
// DASN-SIMEI (declaração anual)
// ---------------------------------------------------------------------------

export const dasnDto = z.object({
  anoBase: z.number().int(),
  /** Apurado a partir dos lançamentos (regime das configurações). */
  faturamentoApurado: centavos,
  receitaComercio: centavos,
  receitaServicos: centavos,
  /** Receitas em categorias sem grupo DASN (precisam de classificação). */
  receitaSemGrupo: centavos,
  faturamentoDeclarado: centavos.nullable(),
  status: z.enum(STATUS_DASN),
  dataEntrega: isoDate.nullable(),
  numeroRecibo: z.string().nullable(),
  /** 31/05 do ano seguinte (parametrizável). */
  prazo: isoDate,
  /** Janela: só pode ser entregue a partir de 01/01 do ano seguinte. */
  janelaAberta: z.boolean(),
  atrasada: z.boolean(),
  diasParaPrazo: z.number().int(),
  /** Competências devidas do ano-base sem DAS pago. */
  dasPendentes: z.array(competencia),
  alertaSemGrupo: z.boolean(),
  /** Situação do limite no ano-base (para exibir excesso na DASN). */
  percentualLimite: z.number(),
  excesso: z.enum(TIPOS_EXCESSO).nullable(),
});
export type DasnDto = z.infer<typeof dasnDto>;

export const dasnQuery = anoQuery;
export type DasnQuery = z.infer<typeof dasnQuery>;

export const anoBaseParam = z.object({
  anoBase: z.coerce.number().int().min(2000, 'Ano inválido').max(2100, 'Ano inválido'),
});
export type AnoBaseParam = z.infer<typeof anoBaseParam>;

/** PUT /obrigacoes/dasn/:anoBase */
export const salvarDasnBody = z
  .object({
    status: z.enum(STATUS_DASN, { error: 'Status deve ser pendente ou entregue' }),
    faturamentoDeclarado: centavosNaoNegativo.nullable().optional(),
    dataEntrega: isoDate.nullable().optional(),
    numeroRecibo: z.string().trim().max(60).nullable().optional(),
  })
  .refine((d) => d.status !== 'entregue' || !!d.dataEntrega, {
    message: 'Informe a data de entrega',
    path: ['dataEntrega'],
  });
export type SalvarDasnBody = z.infer<typeof salvarDasnBody>;

export const dasnResponse = itemResponse(dasnDto);
export type DasnResponse = z.infer<typeof dasnResponse>;

export const listaDasnResponse = listaResponse(dasnDto);
export type ListaDasnResponse = z.infer<typeof listaDasnResponse>;

// ---------------------------------------------------------------------------
// Limite anual de faturamento
// ---------------------------------------------------------------------------

export const situacaoLimiteDto = z.object({
  ano: z.number().int(),
  anoAbertura: z.boolean(),
  mesInicio: z.number().int(),
  mesesConsiderados: z.number().int(),
  limite: centavos,
  tolerancia: centavos,
  acumulado: centavos,
  restante: centavos,
  percentual: z.number(),
  nivel: z.enum(NIVEIS_LIMITE),
  excesso: z.enum(TIPOS_EXCESSO).nullable(),
  valorExcedido: centavos,
  diasDecorridos: z.number().int(),
  diasTotais: z.number().int(),
  mediaMensal: centavos,
  projecao: centavos.nullable(),
  projecaoPercentual: z.number().nullable(),
  projecaoExcede: z.boolean(),
  consequencia: z.string().nullable(),
}) satisfies z.ZodType<SituacaoLimite>;
export type SituacaoLimiteDto = z.infer<typeof situacaoLimiteDto>;

export const limiteQuery = anoQuery;
export type LimiteQuery = z.infer<typeof limiteQuery>;

export const limiteDto = situacaoLimiteDto.extend({
  regime: z.enum(['competencia', 'caixa']),
  /** Faturamento mês a mês do ano (12 posições, meses futuros = 0). */
  porMes: z.array(
    z.object({
      competencia,
      valor: centavos,
      acumulado: centavos,
      percentualAcumulado: z.number(),
    }),
  ),
  marcas: z.array(z.number()),
});
export type LimiteDto = z.infer<typeof limiteDto>;

export const limiteResponse = itemResponse(limiteDto);
export type LimiteResponse = z.infer<typeof limiteResponse>;

// ---------------------------------------------------------------------------
// Calendário
// ---------------------------------------------------------------------------

export const TIPOS_EVENTO_CALENDARIO = [
  'das',
  'dasn',
  'parcela_pagar',
  'parcela_receber',
  'lancamento_pendente',
  'feriado',
] as const;
export type TipoEventoCalendario = (typeof TIPOS_EVENTO_CALENDARIO)[number];

export const calendarioQuery = periodoQuery;
export type CalendarioQuery = z.infer<typeof calendarioQuery>;

export const eventoCalendarioDto = z.object({
  data: isoDate,
  tipo: z.enum(TIPOS_EVENTO_CALENDARIO),
  titulo: z.string(),
  valor: centavos.nullable(),
  /** pago | pendente | atrasado | futuro | informativo */
  status: z.enum([...STATUS_DAS, 'informativo']),
  referencia: z.object({
    id: uuid.nullable(),
    competencia: competencia.nullable(),
    ano: z.number().int().nullable(),
  }),
});
export type EventoCalendarioDto = z.infer<typeof eventoCalendarioDto>;

export const calendarioResponse = listaResponse(eventoCalendarioDto);
export type CalendarioResponse = z.infer<typeof calendarioResponse>;

// ---------------------------------------------------------------------------
// Alertas
// ---------------------------------------------------------------------------

export const alertaDto = z.object({
  /** Chave estável (ex.: das:2026-03:atrasado). */
  chave: z.string(),
  severidade: z.enum(SEVERIDADES_ALERTA),
  titulo: z.string(),
  mensagem: z.string(),
  acao: z.object({ rotulo: z.string(), url: z.string() }).nullable(),
  referencia: z.object({
    tipo: z.string(),
    competencia: competencia.nullable(),
    ano: z.number().int().nullable(),
  }),
  dispensavel: z.boolean(),
}) satisfies z.ZodType<Alerta>;
export type AlertaDto = z.infer<typeof alertaDto>;

export const alertasResponse = listaResponse(alertaDto);
export type AlertasResponse = z.infer<typeof alertasResponse>;

export const chaveAlertaParam = z.object({
  chave: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-z_]+(:[A-Za-z0-9_-]+)+$/, 'Chave de alerta inválida'),
});
export type ChaveAlertaParam = z.infer<typeof chaveAlertaParam>;

/** POST /obrigacoes/alertas/:chave/dispensar */
export const dispensarAlertaBody = z.object({
  /** Até quando fica oculto; omitido = até o alerta deixar de existir (30 dias por padrão na API). */
  ate: isoDate.optional(),
});
export type DispensarAlertaBody = z.infer<typeof dispensarAlertaBody>;

export const dispensarAlertaResponse = itemResponse(
  z.object({ chave: z.string(), dispensadoAte: isoDate }),
);
export type DispensarAlertaResponse = z.infer<typeof dispensarAlertaResponse>;

export const reativarAlertaResponse = okResponse;
export type ReativarAlertaResponse = z.infer<typeof reativarAlertaResponse>;
