// Cores dos gráficos lidas das variáveis CSS do tema (globals.css), com fallback para uso
// fora do navegador (testes). Recharts recebe strings de cor resolvidas.
import { useMemo } from 'react';

const FALLBACK: Record<string, string> = {
  '--color-primary-600': '#0f766e',
  '--color-receita-600': '#16a34a',
  '--color-despesa-600': '#dc2626',
  '--color-alerta-500': '#f59e0b',
  '--color-info-600': '#2563eb',
  '--color-zinc-200': '#e4e4e7',
  '--color-zinc-500': '#71717a',
  '--color-zinc-700': '#3f3f46',
  '--color-grafico-1': '#0f766e',
  '--color-grafico-2': '#2563eb',
  '--color-grafico-3': '#f59e0b',
  '--color-grafico-4': '#9333ea',
  '--color-grafico-5': '#0891b2',
  '--color-grafico-6': '#65a30d',
  '--color-grafico-7': '#e11d48',
  '--color-grafico-8': '#6b7280',
};

/** Lê uma variável CSS de :root (ou devolve o fallback). */
export function lerCssVar(nome: string, fallback = FALLBACK[nome] ?? '#000'): string {
  if (typeof window === 'undefined' || typeof getComputedStyle !== 'function') return fallback;
  const valor = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  return valor || fallback;
}

export interface ChartColors {
  primary: string;
  receita: string;
  despesa: string;
  saldo: string;
  alerta: string;
  grid: string;
  eixo: string;
  texto: string;
  /** Paleta categórica (donut por categoria etc.). */
  categoricas: string[];
}

export function chartColors(): ChartColors {
  return {
    primary: lerCssVar('--color-primary-600'),
    receita: lerCssVar('--color-receita-600'),
    despesa: lerCssVar('--color-despesa-600'),
    saldo: lerCssVar('--color-info-600'),
    alerta: lerCssVar('--color-alerta-500'),
    grid: lerCssVar('--color-zinc-200'),
    eixo: lerCssVar('--color-zinc-500'),
    texto: lerCssVar('--color-zinc-700'),
    categoricas: Array.from({ length: 8 }, (_, i) => lerCssVar(`--color-grafico-${i + 1}`)),
  };
}

/** Cores memorizadas por componente (o tema é estático — só claro — então não muda em runtime). */
export function useChartColors(): ChartColors {
  return useMemo(() => chartColors(), []);
}

/** Cor categórica pelo índice (cicla a paleta). */
export function corCategorica(indice: number, cores: ChartColors = chartColors()): string {
  const lista = cores.categoricas;
  return lista[indice % lista.length] ?? lista[0] ?? '#000';
}
