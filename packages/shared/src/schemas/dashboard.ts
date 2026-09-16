// Contratos do módulo "dashboard" (seção 4 do plano): resumo, fluxo de caixa, por categoria/contato, comparativo mensal.
import { z } from 'zod';

import {
  AGRUPAMENTOS_FLUXO,
  TIPOS_LANCAMENTO,
  TIPOS_PRODUTO_SERVICO,
  TIPOS_TITULO,
} from '../constants.js';
import {
  booleanoQuery,
  centavos,
  competencia,
  isoDate,
  itemResponse,
  periodoDto,
  periodoQuery,
  uuid,
} from './common.js';
import { situacaoLimiteDto } from './obrigacoes.js';

// ---------------------------------------------------------------------------
// Resumo
// ---------------------------------------------------------------------------

export const resumoDashboardQuery = periodoQuery;
export type ResumoDashboardQuery = z.infer<typeof resumoDashboardQuery>;

const indicador = z.object({
  valor: centavos,
  /** Mesmo período imediatamente anterior (mesma duração). */
  anterior: centavos,
  /** Variação percentual em relação ao anterior; null quando anterior = 0. */
  variacao: z.number().nullable(),
});

export const resumoDashboardDto = z.object({
  periodo: periodoDto,
  receitas: indicador,
  despesas: indicador,
  saldo: indicador,
  receitasPendentes: centavos,
  despesasPendentes: centavos,
  saldoPrevisto: centavos,
  quantidadeLancamentos: z.number().int(),
  limite: situacaoLimiteDto.nullable(),
  proximosVencimentos: z.array(
    z.object({
      data: isoDate,
      tipo: z.enum(['das', ...TIPOS_TITULO.map((t) => `parcela_${t}` as const)]),
      titulo: z.string(),
      valor: centavos,
      atrasado: z.boolean(),
      referenciaId: uuid.nullable(),
      competencia: competencia.nullable(),
    }),
  ),
});
export type ResumoDashboardDto = z.infer<typeof resumoDashboardDto>;

export const resumoDashboardResponse = itemResponse(resumoDashboardDto);
export type ResumoDashboardResponse = z.infer<typeof resumoDashboardResponse>;

// ---------------------------------------------------------------------------
// Fluxo de caixa
// ---------------------------------------------------------------------------

export const fluxoCaixaQuery = periodoQuery.safeExtend({
  agrupamento: z.enum(AGRUPAMENTOS_FLUXO).default('mes'),
  /** Inclui parcelas abertas e lançamentos pendentes como previsão. */
  incluirPrevisao: booleanoQuery.default(true),
});
export type FluxoCaixaQuery = z.infer<typeof fluxoCaixaQuery>;

export const periodoFluxoDto = z.object({
  /** Rótulo do período: AAAA-MM-DD (dia), AAAA-Www (semana) ou AAAA-MM (mês). */
  periodo: z.string(),
  inicio: isoDate,
  fim: isoDate,
  receitas: centavos,
  despesas: centavos,
  receitasPrevistas: centavos,
  despesasPrevistas: centavos,
  /** receitas − despesas realizadas no período. */
  saldoPeriodo: centavos,
  /** Saldo inicial + realizados acumulados até o fim do período. */
  saldoAcumulado: centavos,
  /** Saldo acumulado + previstos acumulados. */
  saldoProjetado: centavos,
});
export type PeriodoFluxoDto = z.infer<typeof periodoFluxoDto>;

export const fluxoCaixaDto = z.object({
  periodo: periodoDto,
  agrupamento: z.enum(AGRUPAMENTOS_FLUXO),
  /** Lançamentos pagos antes de `de`. */
  saldoInicial: centavos,
  periodos: z.array(periodoFluxoDto),
  saldoFinal: centavos,
  saldoProjetado: centavos,
});
export type FluxoCaixaDto = z.infer<typeof fluxoCaixaDto>;

export const fluxoCaixaResponse = itemResponse(fluxoCaixaDto);
export type FluxoCaixaResponse = z.infer<typeof fluxoCaixaResponse>;

// ---------------------------------------------------------------------------
// Por categoria / por contato
// ---------------------------------------------------------------------------

export const porCategoriaQuery = periodoQuery.safeExtend({
  tipo: z.enum(TIPOS_LANCAMENTO).default('despesa'),
  /** Só lançamentos pagos (padrão true). */
  somentePagos: booleanoQuery.default(true),
  /** Top N + "Outras". */
  limite: z.coerce.number().int().min(1).max(50).default(6),
});
export type PorCategoriaQuery = z.infer<typeof porCategoriaQuery>;

export const itemPorCategoriaDto = z.object({
  /** null para o agregado "Outras". */
  categoriaId: uuid.nullable(),
  nome: z.string(),
  cor: z.string().nullable(),
  icone: z.string().nullable(),
  valor: centavos,
  percentual: z.number(),
  quantidade: z.number().int(),
});
export type ItemPorCategoriaDto = z.infer<typeof itemPorCategoriaDto>;

export const porCategoriaDto = z.object({
  periodo: periodoDto,
  tipo: z.enum(TIPOS_LANCAMENTO),
  total: centavos,
  itens: z.array(itemPorCategoriaDto),
});
export type PorCategoriaDto = z.infer<typeof porCategoriaDto>;

export const porCategoriaResponse = itemResponse(porCategoriaDto);
export type PorCategoriaResponse = z.infer<typeof porCategoriaResponse>;

export const porContatoQuery = periodoQuery.safeExtend({
  tipo: z.enum(TIPOS_LANCAMENTO).default('receita'),
  somentePagos: booleanoQuery.default(true),
  limite: z.coerce.number().int().min(1).max(50).default(10),
});
export type PorContatoQuery = z.infer<typeof porContatoQuery>;

export const itemPorContatoDto = z.object({
  /** null para "Sem contato". */
  contatoId: uuid.nullable(),
  nome: z.string(),
  valor: centavos,
  percentual: z.number(),
  quantidade: z.number().int(),
});
export type ItemPorContatoDto = z.infer<typeof itemPorContatoDto>;

export const porContatoDto = z.object({
  periodo: periodoDto,
  tipo: z.enum(TIPOS_LANCAMENTO),
  total: centavos,
  itens: z.array(itemPorContatoDto),
});
export type PorContatoDto = z.infer<typeof porContatoDto>;

export const porContatoResponse = itemResponse(porContatoDto);
export type PorContatoResponse = z.infer<typeof porContatoResponse>;

// ---------------------------------------------------------------------------
// Por produto/serviço
//
// Lê os ITENS dos lançamentos (lancamento_itens), não os lançamentos: a pergunta aqui é "o que
// eu vendo mais", e só os itens sabem o quê. Vendas lançadas sem itens simplesmente não entram —
// o total daqui é menor que o faturamento, e a tela precisa dizer isso.
// ---------------------------------------------------------------------------

export const porProdutoQuery = periodoQuery.safeExtend({
  /** 'produto' | 'servico' para recortar o catálogo; omitido = os dois. */
  tipo: z.enum(TIPOS_PRODUTO_SERVICO).optional(),
  /** Só lançamentos pagos (padrão true). */
  somentePagos: booleanoQuery.default(true),
  /** Ordena por faturamento (padrão) ou por quantidade vendida. */
  ordenarPor: z.enum(['valor', 'quantidade']).default('valor'),
  limite: z.coerce.number().int().min(1).max(50).default(10),
});
export type PorProdutoQuery = z.infer<typeof porProdutoQuery>;

export const itemPorProdutoDto = z.object({
  produtoServicoId: uuid,
  nome: z.string(),
  tipo: z.enum(TIPOS_PRODUTO_SERVICO),
  unidade: z.string().nullable(),
  /** Faturamento do item no período (soma dos totais das linhas). */
  valor: centavos,
  percentual: z.number(),
  /** Quantidade vendida em MILÉSIMOS de unidade (1 un = 1000), como no resto do catálogo. */
  quantidade: z.number().int(),
  /** Em quantas vendas diferentes o item apareceu. */
  vendas: z.number().int(),
});
export type ItemPorProdutoDto = z.infer<typeof itemPorProdutoDto>;

export const porProdutoDto = z.object({
  periodo: periodoDto,
  /** Total dos itens listados + os que ficaram fora do limite. */
  total: centavos,
  itens: z.array(itemPorProdutoDto),
});
export type PorProdutoDto = z.infer<typeof porProdutoDto>;

export const porProdutoResponse = itemResponse(porProdutoDto);
export type PorProdutoResponse = z.infer<typeof porProdutoResponse>;

// ---------------------------------------------------------------------------
// Comparativo mensal
// ---------------------------------------------------------------------------

export const comparativoMensalQuery = z.object({
  meses: z.coerce.number().int().min(1).max(36).default(12),
  /** Último mês incluído (padrão: mês atual). */
  ate: competencia.optional(),
});
export type ComparativoMensalQuery = z.infer<typeof comparativoMensalQuery>;

export const mesComparativoDto = z.object({
  competencia,
  receitas: centavos,
  despesas: centavos,
  saldo: centavos,
  receitasPendentes: centavos,
  despesasPendentes: centavos,
});
export type MesComparativoDto = z.infer<typeof mesComparativoDto>;

export const comparativoMensalDto = z.object({
  meses: z.array(mesComparativoDto),
  medias: z.object({ receitas: centavos, despesas: centavos, saldo: centavos }),
  totais: z.object({ receitas: centavos, despesas: centavos, saldo: centavos }),
});
export type ComparativoMensalDto = z.infer<typeof comparativoMensalDto>;

export const comparativoMensalResponse = itemResponse(comparativoMensalDto);
export type ComparativoMensalResponse = z.infer<typeof comparativoMensalResponse>;
