import { describe, expect, it } from 'vitest';

import {
  arredondarHalfUp,
  bp,
  centavosParaReais,
  formatBRL,
  formatDecimalBR,
  formatQuantidade,
  parseBRL,
  parseQuantidade,
  totalDoItem,
  percentual,
  percentualBp,
  percentualDe,
  reaisParaCentavos,
  somar,
  subtrair,
  valorPorExtenso,
  variacaoPercentual,
} from './money.js';

describe('formatBRL', () => {
  it('formata centavos no padrão brasileiro', () => {
    expect(formatBRL(123456)).toBe('R$ 1.234,56');
    expect(formatBRL(0)).toBe('R$ 0,00');
    expect(formatBRL(5)).toBe('R$ 0,05');
    expect(formatBRL(-1050)).toBe('-R$ 10,50');
    expect(formatBRL(810000000)).toBe('R$ 8.100.000,00');
  });

  it('formatDecimalBR sem símbolo', () => {
    expect(formatDecimalBR(123456)).toBe('1.234,56');
    expect(formatDecimalBR(-5)).toBe('-0,05');
  });

  it('rejeita valores não inteiros', () => {
    expect(() => formatBRL(10.5)).toThrow(TypeError);
    expect(() => formatDecimalBR(10.5)).toThrow(TypeError);
  });
});

describe('parseBRL', () => {
  it.each([
    ['R$ 1.234,56', 123456],
    ['1234,56', 123456],
    ['1.234', 123400],
    ['1.234.567', 123456700],
    ['1234.56', 123456],
    ['12,5', 1250],
    ['0,05', 5],
    ['-12,50', -1250],
    ['R$ -50,00', -5000],
    ['(50,00)', -5000],
    ['(12,50)', -1250],
    ['+10', 1000],
    ['  R$ 10  ', 1000],
    ['1,', 100],
  ])('converte %s em %i centavos', (texto, esperado) => {
    expect(parseBRL(texto)).toBe(esperado);
  });

  it('retorna null para entradas inválidas', () => {
    expect(parseBRL('')).toBeNull();
    expect(parseBRL('   ')).toBeNull();
    expect(parseBRL('-')).toBeNull();
    expect(parseBRL('R$')).toBeNull();
    expect(parseBRL('abc')).toBeNull();
    expect(parseBRL('1,2,3')).toBeNull();
    expect(parseBRL('1,234')).toBeNull();
    expect(parseBRL('1.2.3,4')).toBe(12340);
    expect(parseBRL('1.234.5')).toBeNull();
    expect(parseBRL(12 as unknown as string)).toBeNull();
    expect(parseBRL('99999999999999999')).toBeNull();
  });
});

describe('somar / subtrair', () => {
  it('soma centavos', () => {
    expect(somar(100, 250, -50)).toBe(300);
    expect(somar()).toBe(0);
    expect(subtrair(100, 30)).toBe(70);
  });

  it('rejeita frações', () => {
    expect(() => somar(1, 0.1)).toThrow(TypeError);
    expect(() => subtrair(1, 0.1)).toThrow(TypeError);
  });
});

describe('percentualBp / bp', () => {
  it('aplica basis points com arredondamento half-up', () => {
    expect(percentualBp(162100, 500)).toBe(8105); // INSS 5% do salário mínimo 2026
    expect(percentualBp(162100, 1200)).toBe(19452); // caminhoneiro 12%
    expect(percentualBp(1000, 2000)).toBe(200);
    expect(percentualBp(101, 50)).toBe(1); // 0,505 → 1
    expect(percentualBp(-101, 50)).toBe(-1);
    expect(bp(8_100_000, 2000)).toBe(1_620_000);
  });

  it('rejeita entradas inválidas', () => {
    expect(() => percentualBp(1.5, 100)).toThrow(TypeError);
    expect(() => percentualBp(100, Number.NaN)).toThrow(TypeError);
  });
});

describe('utilitários', () => {
  it('percentualDe / percentual', () => {
    expect(percentualDe(6_400_000, 8_100_000)).toBe(79.01);
    expect(percentualDe(10, 0)).toBe(0);
    expect(percentual(1, 3)).toBe(33.33);
  });

  it('arredondarHalfUp', () => {
    expect(arredondarHalfUp(2.5)).toBe(3);
    expect(arredondarHalfUp(-2.5)).toBe(-3);
    expect(arredondarHalfUp(2.4)).toBe(2);
    expect(arredondarHalfUp(0)).toBe(0);
  });

  it('reaisParaCentavos / centavosParaReais', () => {
    expect(reaisParaCentavos(19.99)).toBe(1999);
    expect(reaisParaCentavos(0.1 + 0.2)).toBe(30);
    expect(() => reaisParaCentavos(Number.POSITIVE_INFINITY)).toThrow(TypeError);
    expect(centavosParaReais(1999)).toBe(19.99);
    expect(() => centavosParaReais(1.5)).toThrow(TypeError);
  });

  it('variacaoPercentual', () => {
    expect(variacaoPercentual(1200, 1000)).toBe(20);
    expect(variacaoPercentual(800, 1000)).toBe(-20);
    expect(variacaoPercentual(-500, -1000)).toBe(50);
    expect(variacaoPercentual(100, 0)).toBeNull();
  });
});

describe('totalDoItem (quantidade em milésimos × preço em centavos)', () => {
  it('quantidade inteira é multiplicação simples', () => {
    // 3 bolos a R$ 45,00
    expect(totalDoItem(3000, 4500)).toBe(13_500);
    expect(totalDoItem(1000, 1)).toBe(1);
    expect(totalDoItem(1000, 0)).toBe(0);
  });

  it('quantidade fracionada arredonda half-up no centavo', () => {
    // 1,5 kg a R$ 10,33 = 1.549,5 centavos → R$ 15,50 (meio para cima)
    expect(totalDoItem(1500, 1033)).toBe(1550);
    // 0,333 h a R$ 100,00 = 3.330 centavos exatos
    expect(totalDoItem(333, 10_000)).toBe(3330);
    // 1,5 × R$ 0,01 = 1,5 centavo → 2 centavos
    expect(totalDoItem(1500, 1)).toBe(2);
    // 1,4 × R$ 0,01 = 1,4 centavo → 1 centavo (abaixo do meio, desce)
    expect(totalDoItem(1400, 1)).toBe(1);
    // 2,5 × R$ 0,01 = 2,5 centavos → 3 (half-UP, não "half-even" que daria 2)
    expect(totalDoItem(2500, 1)).toBe(3);
  });

  it('não usa ponto flutuante: 0,1 + 0,2 não contamina o total', () => {
    // 0,001 un a R$ 0,01 = 0,01 centavo → 0 (trunca para baixo, não vira 1)
    expect(totalDoItem(1, 1)).toBe(0);
    // Três linhas de 0,1 un a R$ 3,33 somam exatamente o mesmo que a conta manual
    const linha = totalDoItem(100, 333);
    expect(linha).toBe(33);
    expect(linha * 3).toBe(99);
  });

  it('recusa entradas que não são inteiros não negativos', () => {
    expect(() => totalDoItem(1.5, 1000)).toThrow(TypeError);
    expect(() => totalDoItem(-1000, 1000)).toThrow(TypeError);
    expect(() => totalDoItem(1000, -1)).toThrow(TypeError);
    expect(() => totalDoItem(1000, 10.5)).toThrow(TypeError);
  });
});

describe('quantidade em milésimos', () => {
  it('formatQuantidade mostra só as casas necessárias', () => {
    expect(formatQuantidade(3000)).toBe('3');
    expect(formatQuantidade(1500)).toBe('1,5');
    expect(formatQuantidade(250)).toBe('0,25');
    expect(formatQuantidade(1)).toBe('0,001');
    expect(formatQuantidade(0)).toBe('0');
  });

  it('parseQuantidade aceita vírgula e ponto e trunca em três casas', () => {
    expect(parseQuantidade('3')).toBe(3000);
    expect(parseQuantidade('1,5')).toBe(1500);
    expect(parseQuantidade('1.5')).toBe(1500);
    expect(parseQuantidade('0,2505')).toBe(250);
    expect(parseQuantidade('')).toBeNull();
    expect(parseQuantidade('abc')).toBeNull();
    expect(parseQuantidade('-2')).toBeNull();
  });
});

describe('valorPorExtenso (recibos)', () => {
  // Tabela: cada linha é um caso onde o código ingênuo erra.
  const casos: [number, string][] = [
    [0, 'zero reais'],
    [1, 'um centavo'],
    [99, 'noventa e nove centavos'],
    [100, 'um real'],
    [200, 'dois reais'],
    [123, 'um real e vinte e três centavos'],
    // "cem" exato x "cento e ..." — o erro clássico.
    [10_000, 'cem reais'],
    [10_100, 'cento e um reais'],
    [19_900, 'cento e noventa e nove reais'],
    // "mil", não "um mil".
    [100_000, 'mil reais'],
    [100_100, 'mil e um reais'],
    [150_000, 'mil e quinhentos reais'],
    // Vírgula quando o último grupo não é "redondo"; "e" quando é.
    [123_000, 'mil, duzentos e trinta reais'],
    [200_000, 'dois mil reais'],
    [210_000, 'dois mil e cem reais'],
    [1_234_567, 'doze mil, trezentos e quarenta e cinco reais e sessenta e sete centavos'],
    // Milhão: singular x plural, e a preposição "de" só quando termina na escala.
    [100_000_000, 'um milhão de reais'],
    [200_000_000, 'dois milhões de reais'],
    [100_000_100, 'um milhão e um reais'],
    [100_005_000, 'um milhão e cinquenta reais'],
    // "mil" nunca leva "de".
    [200_000, 'dois mil reais'],
    // Grupos zerados no meio não podem virar escala solta: R$ 1.000.000.050,00.
    [100_000_005_000, 'um bilhão e cinquenta reais'],
    [100_000_000_000, 'um bilhão de reais'],
  ];

  it.each(casos)('%i centavos → "%s"', (centavos, esperado) => {
    expect(valorPorExtenso(centavos)).toBe(esperado);
  });

  it('recusa valor negativo (não existe recibo de valor negativo)', () => {
    expect(() => valorPorExtenso(-100)).toThrow(RangeError);
  });

  it('recusa valor não inteiro (centavos são inteiros)', () => {
    expect(() => valorPorExtenso(10.5)).toThrow();
  });
});
