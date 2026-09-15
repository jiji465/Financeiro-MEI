// Contratos do módulo "produtos-servicos": o catálogo do MEI (o que ele vende e o que ele presta)
// e os itens de um lançamento (3 bolos + 2 tortas na mesma venda).
//
// Duas disciplinas numéricas, as duas com inteiros:
//   - dinheiro em CENTAVOS (como no resto do sistema);
//   - quantidade em MILÉSIMOS de unidade (1,5 kg = 1500) — ver `totalDoItem` em money.ts.
import { z } from 'zod';

import { TIPOS_PRODUTO_SERVICO } from '../constants.js';
import {
  booleanoQuery,
  centavos,
  centavosNaoNegativo,
  itemResponse,
  listaResponse,
  okResponse,
  produtoServicoRef,
  textoNulavel,
  timestamp,
  uuid,
} from './common.js';

// ---------------------------------------------------------------------------
// Limites
// ---------------------------------------------------------------------------

/**
 * Tetos de quantidade e preço unitário. Não são regra fiscal: existem para que
 * `quantidade × valorUnitario` (ver `totalDoItem`) nunca passe do inteiro seguro do JavaScript —
 * 1e8 × 1e7 = 1e15, bem abaixo de 2^53. Os dois são folgados para um MEI, cujo teto de
 * faturamento anual é de R$ 81.000,00.
 */
export const ITEM_QUANTIDADE_MAX = 100_000_000; // 100.000 unidades (em milésimos)
export const ITEM_VALOR_UNITARIO_MAX = 10_000_000; // R$ 100.000,00 (em centavos)
/** Linhas por lançamento: acima disso é planilha, não venda de balcão. */
export const ITENS_POR_LANCAMENTO_MAX = 100;

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export const produtoServicoDto = z.object({
  id: uuid,
  tipo: z.enum(TIPOS_PRODUTO_SERVICO),
  nome: z.string(),
  descricao: z.string().nullable(),
  /** Preço sugerido em centavos; null quando o MEI cobra caso a caso. Nunca trava a venda. */
  precoPadrao: centavos.nullable(),
  /** Unidade de medida em texto curto ("un", "kg", "h", "m²"); null quando não faz sentido. */
  unidade: z.string().nullable(),
  ativo: z.boolean(),
  /** Quantos lançamentos (não excluídos) já usaram este item — só informativo. */
  lancamentos: z.number().int(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type ProdutoServicoDto = z.infer<typeof produtoServicoDto>;

/** Versão enxuta para o seletor de itens do lançamento. */
export const produtoServicoOpcaoDto = z.object({
  id: uuid,
  tipo: z.enum(TIPOS_PRODUTO_SERVICO),
  nome: z.string(),
  precoPadrao: centavos.nullable(),
  unidade: z.string().nullable(),
});
export type ProdutoServicoOpcaoDto = z.infer<typeof produtoServicoOpcaoDto>;

const produtoServicoCampos = z.object({
  tipo: z.enum(TIPOS_PRODUTO_SERVICO, { error: 'Escolha entre produto e serviço' }),
  nome: z
    .string()
    .trim()
    .min(2, 'Informe o nome')
    .max(120, 'Nome deve ter no máximo 120 caracteres'),
  descricao: textoNulavel,
  /** null = sem preço padrão (o valor é combinado em cada venda). */
  precoPadrao: centavosNaoNegativo.nullable().optional(),
  unidade: z
    .string()
    .trim()
    .max(10, 'Unidade deve ter no máximo 10 caracteres')
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v)),
});

export const criarProdutoServicoBody = produtoServicoCampos;
export type CriarProdutoServicoBody = z.infer<typeof criarProdutoServicoBody>;

export const atualizarProdutoServicoBody = produtoServicoCampos
  .partial()
  .extend({ ativo: z.boolean().optional() });
export type AtualizarProdutoServicoBody = z.infer<typeof atualizarProdutoServicoBody>;

export const listarProdutosServicosQuery = z.object({
  tipo: z.enum(TIPOS_PRODUTO_SERVICO).optional(),
  /** Omitido = ativos e inativos; true = só ativos; false = só inativos. */
  ativo: booleanoQuery.optional(),
  busca: z.string().trim().max(80).optional(),
});
export type ListarProdutosServicosQuery = z.infer<typeof listarProdutosServicosQuery>;

export const produtoServicoResponse = itemResponse(produtoServicoDto);
export type ProdutoServicoResponse = z.infer<typeof produtoServicoResponse>;

export const listaProdutosServicosResponse = listaResponse(produtoServicoDto);
export type ListaProdutosServicosResponse = z.infer<typeof listaProdutosServicosResponse>;

export const opcoesProdutosServicosResponse = listaResponse(produtoServicoOpcaoDto);
export type OpcoesProdutosServicosResponse = z.infer<typeof opcoesProdutosServicosResponse>;

export const excluirProdutoServicoResponse = okResponse;
export type ExcluirProdutoServicoResponse = z.infer<typeof excluirProdutoServicoResponse>;

// ---------------------------------------------------------------------------
// Itens do lançamento
// ---------------------------------------------------------------------------

/** Quantidade em milésimos de unidade, inteira e positiva (1,5 kg = 1500). */
export const quantidadeMilesimos = z
  .number()
  .int('Quantidade deve ser um inteiro em milésimos de unidade')
  .positive('Quantidade deve ser maior que zero')
  .max(ITEM_QUANTIDADE_MAX, 'Quantidade grande demais');

export const lancamentoItemDto = z.object({
  id: uuid,
  produtoServicoId: uuid,
  /** Null quando o item do catálogo foi excluído depois da venda (o histórico continua válido). */
  produtoServico: produtoServicoRef.nullable(),
  quantidade: quantidadeMilesimos,
  valorUnitario: centavos,
  /** Calculado pela API (`totalDoItem`), nunca aceito do cliente. */
  valorTotal: centavos,
});
export type LancamentoItemDto = z.infer<typeof lancamentoItemDto>;

/**
 * Linha enviada no POST/PATCH de lançamento. O total não entra: a API recalcula a partir de
 * quantidade × valor unitário para que ninguém grave um total que não fecha com a própria linha.
 */
export const lancamentoItemInput = z.object({
  produtoServicoId: uuid,
  quantidade: quantidadeMilesimos,
  valorUnitario: centavosNaoNegativo.max(ITEM_VALOR_UNITARIO_MAX, 'Valor unitário grande demais'),
});
export type LancamentoItemInput = z.infer<typeof lancamentoItemInput>;

export const lancamentoItensInput = z
  .array(lancamentoItemInput)
  .max(ITENS_POR_LANCAMENTO_MAX, `No máximo ${ITENS_POR_LANCAMENTO_MAX} itens por lançamento`);
export type LancamentoItensInput = z.infer<typeof lancamentoItensInput>;
