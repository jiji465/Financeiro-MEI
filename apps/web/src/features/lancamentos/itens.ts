// Regras da seção "Itens" do lançamento que não são componente: schema de uma linha e as contas
// de total. Ficam fora de components/itens-campo.tsx para o arquivo de componente exportar só
// componente (fast refresh).
//
// A conta de total é `totalDoItem` do @meifin/shared — a MESMA função que a API usa para gravar:
// round(quantidade × valorUnitario / 1000) meio para cima, em aritmética inteira. Não existe uma
// segunda regra de arredondamento no web.
import { totalDoItem } from '@meifin/shared';
import { z } from 'zod';

/** Uma linha do formulário. `quantidade` em milésimos; `valorUnitario` em centavos. */
export const itemFormSchema = z.object({
  produtoServicoId: z
    .string()
    .nullable()
    .refine((v): v is string => Boolean(v), 'Escolha o produto ou serviço'),
  quantidade: z
    .number()
    .nullable()
    .refine((v): v is number => v !== null && v > 0, 'Informe a quantidade'),
  valorUnitario: z
    .number()
    .nullable()
    .refine((v): v is number => v !== null && v >= 0, 'Informe o valor unitário'),
});

export interface ItemFormValores {
  produtoServicoId: string | null;
  quantidade: number | null;
  valorUnitario: number | null;
}

/** Linha nova: 1 unidade, sem item escolhido (o preço vem do catálogo na escolha). */
export const ITEM_VAZIO: ItemFormValores = {
  produtoServicoId: null,
  quantidade: 1000,
  valorUnitario: null,
};

/** Total de uma linha; 0 enquanto ela está incompleta. */
export function totalDaLinha(item: ItemFormValores | undefined): number {
  if (!item || item.quantidade === null || item.valorUnitario === null) return 0;
  if (item.quantidade <= 0 || item.valorUnitario < 0) return 0;
  return totalDoItem(item.quantidade, item.valorUnitario);
}

/**
 * Soma dos totais JÁ ARREDONDADOS de cada linha — a mesma ordem de contas da API, para que o
 * número mostrado na tela e o número conferido lá sejam sempre o mesmo.
 */
export function somaDosItens(itens: readonly ItemFormValores[] | undefined): number {
  return (itens ?? []).reduce((soma, item) => soma + totalDaLinha(item), 0);
}

/** Itens do formulário no formato do corpo da API (linhas incompletas não chegam lá). */
export function montarItensDoBody(itens: readonly ItemFormValores[]) {
  return itens
    .filter(
      (i): i is { produtoServicoId: string; quantidade: number; valorUnitario: number } =>
        Boolean(i.produtoServicoId) && i.quantidade !== null && i.valorUnitario !== null,
    )
    .map((i) => ({
      produtoServicoId: i.produtoServicoId,
      quantidade: i.quantidade,
      valorUnitario: i.valorUnitario,
    }));
}
