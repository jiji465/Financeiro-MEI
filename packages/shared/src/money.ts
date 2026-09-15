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

/**
 * Quantidade de um item de venda em MILÉSIMOS de unidade, sempre inteira: 1 un = 1000,
 * 1,5 kg = 1500, 0,25 h = 250. O projeto não usa float nem `numeric` para dinheiro e a mesma
 * disciplina vale aqui — 0,1 + 0,2 ≠ 0,3 em ponto flutuante, e uma venda de 3 bolos não pode
 * depender disso.
 */
export type Milesimos = number;

/** 1 unidade em milésimos (fator de conversão quantidade → unidades). */
export const MILESIMOS_POR_UNIDADE = 1000;

/**
 * Total de um item de venda: quantidade (milésimos) × valor unitário (centavos) ÷ 1000,
 * arredondado half-up (meio para cima) ao centavo.
 *
 * A conta é feita só com inteiros — `Math.floor(produto / 1000)` mais o resto de `% 1000` —
 * porque `produto / 1000` é uma divisão em ponto flutuante e arredondar o resultado dela
 * erraria o centavo em casos de meio exato (0,5 que vira 0,49999…). Exemplo do dia a dia:
 * 1,5 kg (1500) a R$ 10,33 (1033) = 1.549,5 centavos → R$ 15,50, não R$ 15,49.
 *
 * Só aceita inteiros não negativos: quantidade e preço de item de venda nunca são negativos
 * (devolução é outro lançamento, não item com sinal trocado).
 */
export function totalDoItem(quantidade: Milesimos, valorUnitario: Centavos): Centavos {
  assertCentavos(valorUnitario, 'valorUnitario');
  if (!Number.isSafeInteger(quantidade) || quantidade < 0) {
    throw new TypeError(`quantidade deve ser um inteiro em milésimos (recebido: ${quantidade})`);
  }
  if (valorUnitario < 0) throw new TypeError('valorUnitario não pode ser negativo');
  const produto = quantidade * valorUnitario;
  if (!Number.isSafeInteger(produto)) {
    throw new TypeError('quantidade × valor unitário estourou o inteiro seguro');
  }
  const inteiro = Math.floor(produto / MILESIMOS_POR_UNIDADE);
  const resto = produto % MILESIMOS_POR_UNIDADE;
  return resto >= MILESIMOS_POR_UNIDADE / 2 ? inteiro + 1 : inteiro;
}

/** Formata milésimos como quantidade legível: 1500 → "1,5"; 3000 → "3"; 250 → "0,25". */
export function formatQuantidade(quantidade: Milesimos): string {
  const negativo = quantidade < 0;
  const abs = Math.abs(quantidade);
  const inteiro = Math.trunc(abs / MILESIMOS_POR_UNIDADE);
  const fracao = String(abs % MILESIMOS_POR_UNIDADE)
    .padStart(3, '0')
    .replace(/0+$/, '');
  const texto = fracao ? `${inteiro},${fracao}` : String(inteiro);
  return negativo ? `-${texto}` : texto;
}

/**
 * Converte texto digitado ("1,5", "1.5", "3") em milésimos. Null quando não é número válido.
 * Mais de três casas decimais são truncadas (não existe meio-milésimo de unidade).
 */
export function parseQuantidade(texto: string): Milesimos | null {
  if (typeof texto !== 'string') return null;
  const limpo = texto.replace(/\s/g, '').replace(',', '.');
  if (limpo === '' || !/^\d+(\.\d*)?$/.test(limpo)) return null;
  const [inteiros = '0', decimais = ''] = limpo.split('.');
  const milesimos =
    Number(inteiros) * MILESIMOS_POR_UNIDADE + Number((decimais + '000').slice(0, 3));
  return Number.isSafeInteger(milesimos) ? milesimos : null;
}

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
