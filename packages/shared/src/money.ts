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

/** Formata centavos como "R$ 1.234,56" (espaço comum em vez de NBSP, para facilitar testes e cópia). */
export function formatBRL(centavos: Centavos): string {
  assertCentavos(centavos);
  return formatador.format(centavos / 100).replace(/\u00A0/g, ' ');
}

/**
 * Converte texto digitado ("R$ 1.234,56", "1234,56", "1234.56", "-12,5") em centavos.
 * Retorna null quando o texto não representa um número válido.
 */
export function parseBRL(texto: string): Centavos | null {
  if (typeof texto !== 'string') return null;
  let limpo = texto.replace(/R\$/gi, '').replace(/\s/g, '').trim();
  if (limpo === '') return null;
  const negativo = limpo.startsWith('-') || (limpo.startsWith('(') && limpo.endsWith(')'));
  limpo = limpo.replace(/[()]/g, '').replace(/^[-+]/, '');

  const temVirgula = limpo.includes(',');
  const temPonto = limpo.includes('.');
  let normalizado: string;
  if (temVirgula) {
    // Formato brasileiro: pontos são milhar, vírgula é decimal
    normalizado = limpo.replace(/\./g, '').replace(',', '.');
  } else if (temPonto) {
    // Sem vírgula: um único ponto com 1-2 casas é decimal; caso contrário são milhares
    const partes = limpo.split('.');
    const ultima = partes[partes.length - 1] ?? '';
    normalizado = partes.length === 2 && ultima.length <= 2 ? limpo : partes.join('');
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

/** Percentual (0-100, duas casas) que `parte` representa de `total`; 0 quando total é 0. */
export function percentualDe(parte: Centavos, total: Centavos): number {
  if (total === 0) return 0;
  return Math.round((parte / total) * 10_000) / 100;
}

/** Converte reais (número decimal) em centavos, arredondando half-up. */
export function reaisParaCentavos(reais: number): Centavos {
  if (!Number.isFinite(reais)) throw new TypeError('reais deve ser um número finito');
  return arredondarHalfUp(reais * 100);
}
