// Dinheiro é sempre inteiro em centavos, ponta a ponta. Percentuais em basis points (1% = 100 bp).

/** Valor monetário em centavos (inteiro). */
export type Centavos = number;

/** Basis points: 10000 bp = 100%. */
export type BasisPoints = number;

export function isCentavos(valor: unknown): valor is Centavos {
  return typeof valor === 'number' && Number.isSafeInteger(valor);
}

export function assertCentavos(valor: number, nome = 'valor'): asserts valor is Centavos {
  if (!isCentavos(valor)) {
    throw new TypeError(`${nome} deve ser um inteiro em centavos (recebido: ${String(valor)})`);
  }
}

const formatador = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatadorDecimal = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formata centavos como "R$ 1.234,56" (espaço comum em vez de NBSP, para facilitar testes e cópia). */
export function formatBRL(centavos: Centavos): string {
  assertCentavos(centavos);
  return formatador.format(centavos / 100).replace(/\u00A0/g, ' ');
}

/** Formata centavos sem o símbolo: "1.234,56" (usado em CSV/PDF e inputs). */
export function formatDecimalBR(centavos: Centavos): string {
  assertCentavos(centavos);
  return formatadorDecimal.format(centavos / 100).replace(/\u00A0/g, ' ');
}

/**
 * Converte texto digitado ("R$ 1.234,56", "1234,56", "1234.56", "R$ -50,00", "(50,00)") em centavos.
 * Retorna null quando o texto não representa um número válido.
 */
export function parseBRL(texto: string): Centavos | null {
  if (typeof texto !== 'string') return null;
  let limpo = texto.replace(/R\$/gi, '').replace(/\s/g, '').trim();
  if (limpo === '') return null;
  const negativo = limpo.startsWith('-') || (limpo.startsWith('(') && limpo.endsWith(')'));
  limpo = limpo.replace(/[()]/g, '').replace(/^[-+]/, '');
  if (limpo === '') return null;

  const temVirgula = limpo.includes(',');
  const temPonto = limpo.includes('.');
  let normalizado: string;
  if (temVirgula) {
    // Formato brasileiro: pontos são milhar, vírgula é decimal
    normalizado = limpo.replace(/\./g, '').replace(',', '.');
  } else if (temPonto) {
    // Sem vírgula: um único ponto com 1-2 casas é decimal; caso contrário são milhares (grupos de 3)
    const partes = limpo.split('.');
    const ultima = partes[partes.length - 1] ?? '';
    if (partes.length === 2 && ultima.length <= 2) normalizado = limpo;
    else if (partes.slice(1).every((p) => p.length === 3)) normalizado = partes.join('');
    else return null;
  } else {
    normalizado = limpo;
  }
  if (!/^\d+(\.\d{0,2})?$/.test(normalizado)) return null;

  const [inteiros = '0', decimais = ''] = normalizado.split('.');
  const centavos = Number(inteiros) * 100 + Number((decimais + '00').slice(0, 2));
  if (!Number.isSafeInteger(centavos)) return null;
  return negativo ? -centavos : centavos;
}

/** Soma segura de centavos. */
export function somar(...valores: Centavos[]): Centavos {
  let total = 0;
  for (const v of valores) {
    assertCentavos(v);
    total += v;
  }
  return total;
}

/** Subtração segura de centavos (a − b). */
export function subtrair(a: Centavos, b: Centavos): Centavos {
  assertCentavos(a, 'a');
  assertCentavos(b, 'b');
  return a - b;
}

/** Arredondamento "comercial" (half-up) para inteiro, também para negativos. */
export function arredondarHalfUp(valor: number): number {
  return Math.sign(valor) * Math.floor(Math.abs(valor) + 0.5);
}

/** Aplica um percentual em basis points a um valor em centavos, com arredondamento half-up. */
export function percentualBp(valor: Centavos, bp: BasisPoints): Centavos {
  assertCentavos(valor);
  if (!Number.isFinite(bp)) throw new TypeError('bp deve ser um número finito');
  return arredondarHalfUp((valor * bp) / 10_000);
}

/** Alias curto de percentualBp: bp(162100, 500) = 8105. */
export const bp = percentualBp;

/** Percentual (0-100, duas casas) que `parte` representa de `total`; 0 quando total é 0. */
export function percentualDe(parte: Centavos, total: Centavos): number {
  if (total === 0) return 0;
  return Math.round((parte / total) * 10_000) / 100;
}

/** Alias curto de percentualDe: percentual(6_400_000, 8_100_000) = 79.01. */
export const percentual = percentualDe;

/** Converte reais (número decimal) em centavos, arredondando half-up. */
export function reaisParaCentavos(reais: number): Centavos {
  if (!Number.isFinite(reais)) throw new TypeError('reais deve ser um número finito');
  return arredondarHalfUp(reais * 100);
}

/** Converte centavos em reais (número decimal, duas casas). Uso restrito a exibição/gráficos. */
export function centavosParaReais(centavos: Centavos): number {
  assertCentavos(centavos);
  return Math.round(centavos) / 100;
}

/** Percentual (0-100, duas casas) de variação entre `anterior` e `atual`; null quando anterior é 0. */
export function variacaoPercentual(atual: Centavos, anterior: Centavos): number | null {
  if (anterior === 0) return null;
  return Math.round(((atual - anterior) / Math.abs(anterior)) * 10_000) / 100;
}
