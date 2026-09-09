// Parcelamento de títulos: base = floor(total/n), resto na última parcela; vencimentos mensais
// com clamp de fim de mês (31/01 → 28/02 → 31/03). Invariante: Σ valor = total.
import { addMonthsClamp, type IsoDate } from '../dates.js';
import { assertCentavos, type Centavos } from '../money.js';

export interface ParcelaGerada {
  numero: number;
  vencimento: IsoDate;
  valor: Centavos;
}

/** Divide `total` em `n` partes inteiras: base em todas, resto (centavos) na última. */
export function distribuirValor(total: Centavos, n: number): Centavos[] {
  assertCentavos(total, 'total');
  if (total <= 0) throw new RangeError('total deve ser maior que zero');
  if (!Number.isInteger(n) || n < 1) throw new RangeError('quantidade de parcelas deve ser ≥ 1');
  const base = Math.floor(total / n);
  const resto = total - base * n;
  const valores = new Array<Centavos>(n).fill(base);
  valores[n - 1] = base + resto;
  return valores;
}

/**
 * Gera n parcelas mensais a partir do primeiro vencimento. O dia do mês é preservado quando existe
 * e "gruda" no fim do mês quando não (31/01 → 28/02 → 31/03), sempre relativo ao primeiro vencimento.
 */
export function gerarParcelas(
  total: Centavos,
  n: number,
  primeiroVencimento: IsoDate,
): ParcelaGerada[] {
  const valores = distribuirValor(total, n);
  return valores.map((valor, i) => ({
    numero: i + 1,
    vencimento: addMonthsClamp(primeiroVencimento, i),
    valor,
  }));
}

/** Soma das parcelas (para checar a invariante Σ = total em listas manuais). */
export function somarParcelas(parcelas: readonly { valor: Centavos }[]): Centavos {
  return parcelas.reduce((acc, p) => acc + p.valor, 0);
}

/** true quando a lista soma exatamente o total e todas as parcelas são positivas. */
export function validarListaParcelas(
  parcelas: readonly { valor: Centavos }[],
  total: Centavos,
): boolean {
  return (
    parcelas.length > 0 && parcelas.every((p) => p.valor > 0) && somarParcelas(parcelas) === total
  );
}
