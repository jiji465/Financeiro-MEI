// DRE simplificada do MEI: receitas e despesas agrupadas por categoria, impostos destacados,
// resultado e margem. Entrada: linhas já filtradas pelo período/regime (a API faz a consulta).
import type { GrupoDasn, TipoLancamento } from '../constants.js';
import { type Centavos, percentualDe } from '../money.js';

export interface LinhaDre {
  tipo: TipoLancamento;
  categoriaId: string | null;
  categoriaNome: string;
  grupoDasn: GrupoDasn | null;
  /** Categoria de sistema "Impostos e DAS" → entra em `impostos`. */
  categoriaSistema: boolean;
  valor: Centavos;
}

export interface ItemDre {
  categoriaId: string | null;
  nome: string;
  grupoDasn: GrupoDasn | null;
  valor: Centavos;
  /** Participação no total do grupo (receitas ou despesas), 0-100. */
  percentual: number;
  quantidade: number;
}

export interface GrupoDre {
  total: Centavos;
  itens: ItemDre[];
}

export interface Dre {
  receitas: GrupoDre;
  despesas: GrupoDre;
  /** Impostos (categorias de sistema), já incluídos nas despesas. */
  impostos: Centavos;
  resultado: Centavos;
  /** resultado / receitas (0-100, pode ser negativo); null sem receitas. */
  margem: number | null;
}

const SEM_CATEGORIA = 'Sem categoria';

function agrupar(linhas: readonly LinhaDre[]): GrupoDre {
  const mapa = new Map<string, ItemDre>();
  let total = 0;
  for (const l of linhas) {
    const chave = l.categoriaId ?? '';
    const item = mapa.get(chave) ?? {
      categoriaId: l.categoriaId,
      nome: l.categoriaNome || SEM_CATEGORIA,
      grupoDasn: l.grupoDasn,
      valor: 0,
      percentual: 0,
      quantidade: 0,
    };
    item.valor += l.valor;
    item.quantidade += 1;
    total += l.valor;
    mapa.set(chave, item);
  }
  const itens = [...mapa.values()]
    .map((i) => ({ ...i, percentual: percentualDe(i.valor, total) }))
    .sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, 'pt-BR'));
  return { total, itens };
}

/** Monta a DRE a partir das linhas (uma por lançamento ou já agregadas por categoria). */
export function montarDre(linhas: readonly LinhaDre[]): Dre {
  const receitas = agrupar(linhas.filter((l) => l.tipo === 'receita'));
  const despesas = agrupar(linhas.filter((l) => l.tipo === 'despesa'));
  const impostos = linhas
    .filter((l) => l.tipo === 'despesa' && l.categoriaSistema)
    .reduce((acc, l) => acc + l.valor, 0);
  const resultado = receitas.total - despesas.total;
  const margem =
    receitas.total === 0 ? null : Math.round((resultado / receitas.total) * 10_000) / 100;
  return { receitas, despesas, impostos, resultado, margem };
}
