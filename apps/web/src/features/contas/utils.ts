// Regras de apresentação das contas: agrupamento por vencimento e rótulos por tipo.
import {
  addDias,
  gerarParcelas,
  hojeSP,
  type IsoDate,
  type ParcelaComTituloDto,
  type TipoTitulo,
} from '@meifin/shared';

import { formatBRL } from '@/lib/format/money';

export const GRUPOS_VENCIMENTO = [
  'vencidas',
  'hoje',
  'sete_dias',
  'trinta_dias',
  'depois',
] as const;
export type GrupoVencimento = (typeof GRUPOS_VENCIMENTO)[number];

export const GRUPO_LABELS: Record<GrupoVencimento, string> = {
  vencidas: 'Vencidas',
  hoje: 'Vencem hoje',
  sete_dias: 'Próximos 7 dias',
  trinta_dias: 'Próximos 30 dias',
  depois: 'Depois',
};

export function grupoDeVencimento(vencimento: IsoDate, hoje: IsoDate = hojeSP()): GrupoVencimento {
  if (vencimento < hoje) return 'vencidas';
  if (vencimento === hoje) return 'hoje';
  if (vencimento <= addDias(hoje, 7)) return 'sete_dias';
  if (vencimento <= addDias(hoje, 30)) return 'trinta_dias';
  return 'depois';
}

export interface GrupoParcelas {
  grupo: GrupoVencimento;
  label: string;
  itens: ParcelaComTituloDto[];
  total: number;
}

/** Agrupa parcelas (já ordenadas por vencimento) mantendo só os grupos com itens. */
export function agruparPorVencimento(
  parcelas: readonly ParcelaComTituloDto[],
  hoje: IsoDate = hojeSP(),
): GrupoParcelas[] {
  const mapa = new Map<GrupoVencimento, ParcelaComTituloDto[]>();
  for (const p of parcelas) {
    const g = grupoDeVencimento(p.vencimento, hoje);
    mapa.set(g, [...(mapa.get(g) ?? []), p]);
  }
  return GRUPOS_VENCIMENTO.filter((g) => mapa.has(g)).map((grupo) => {
    const itens = mapa.get(grupo)!;
    return {
      grupo,
      label: GRUPO_LABELS[grupo],
      itens,
      total: itens.reduce((acc, p) => acc + p.valor, 0),
    };
  });
}

export interface TextosTipo {
  titulo: string;
  singular: string;
  plural: string;
  novo: string;
  baixar: string;
  baixado: string;
  contatoLabel: string;
  vazio: string;
}

export const TEXTOS_POR_TIPO: Record<TipoTitulo, TextosTipo> = {
  pagar: {
    titulo: 'Contas a pagar',
    singular: 'conta a pagar',
    plural: 'contas a pagar',
    novo: 'Nova conta a pagar',
    baixar: 'Pagar',
    baixado: 'Pagas',
    contatoLabel: 'Fornecedor',
    vazio: 'Nenhuma conta a pagar em aberto.',
  },
  receber: {
    titulo: 'Contas a receber',
    singular: 'conta a receber',
    plural: 'contas a receber',
    novo: 'Nova conta a receber',
    baixar: 'Receber',
    baixado: 'Recebidas',
    contatoLabel: 'Cliente',
    vazio: 'Nenhuma conta a receber em aberto.',
  },
};

/** "3x de R$ 33,33 (última de R$ 33,34)" — prévia do parcelamento automático. */
export function descreverParcelamento(
  total: number | null | undefined,
  quantidade: number | null | undefined,
  primeiroVencimento: string | null | undefined,
): string | null {
  if (!total || total <= 0 || !quantidade || quantidade < 1 || !primeiroVencimento) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(primeiroVencimento)) return null;
  let parcelas;
  try {
    parcelas = gerarParcelas(total, Math.trunc(quantidade), primeiroVencimento);
  } catch {
    return null;
  }
  const primeira = parcelas[0]!;
  const ultima = parcelas[parcelas.length - 1]!;
  if (parcelas.length === 1) return `Parcela única de ${formatBRL(primeira.valor)}`;
  const base = `${parcelas.length}x de ${formatBRL(primeira.valor)}`;
  return ultima.valor !== primeira.valor ? `${base} (última de ${formatBRL(ultima.valor)})` : base;
}
