// Dinheiro no web: reexporta as funções do shared (fonte única) e adiciona formatos de exibição.
import { formatBRL, parseBRL, type Centavos } from '@meifin/shared';

export { formatBRL, parseBRL, percentualDe, reaisParaCentavos, somar } from '@meifin/shared';
export type { Centavos } from '@meifin/shared';

const formatadorSemSimbolo = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "1.234,56" (sem R$) — usado no MoneyInput e em tabelas com cabeçalho "R$". */
export function formatCentavos(centavos: Centavos): string {
  return formatadorSemSimbolo.format(centavos / 100);
}

/** "+R$ 1.234,56" / "−R$ 1.234,56" (sinal explícito; zero sem sinal). */
export function formatBRLComSinal(centavos: Centavos): string {
  const texto = formatBRL(Math.abs(centavos));
  if (centavos > 0) return `+${texto}`;
  if (centavos < 0) return `−${texto}`;
  return texto;
}

/** Formato compacto para cards e eixos: "R$ 1,2 mil", "R$ 3,4 mi", "R$ 850". */
export function formatBRLCompact(centavos: Centavos): string {
  const reais = centavos / 100;
  const abs = Math.abs(reais);
  const sinal = reais < 0 ? '−' : '';
  const umaCasa = (n: number) =>
    n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  if (abs >= 1_000_000_000) return `${sinal}R$ ${umaCasa(abs / 1_000_000_000)} bi`;
  if (abs >= 1_000_000) return `${sinal}R$ ${umaCasa(abs / 1_000_000)} mi`;
  if (abs >= 1_000) return `${sinal}R$ ${umaCasa(abs / 1_000)} mil`;
  return `${sinal}R$ ${Math.round(abs).toLocaleString('pt-BR')}`;
}

/** Percentual (0-100) como "12,5%"; casas decimais opcionais. */
export function formatPercentual(valor: number, casas = 1): string {
  return `${valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: casas,
  })}%`;
}

/** Converte string do MoneyInput/CSV em centavos ou null (alias documentado do shared). */
export function parseCentavos(texto: string): Centavos | null {
  return parseBRL(texto);
}
