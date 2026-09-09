import { describe, expect, it } from 'vitest';

import {
  arredondarHalfUp,
  bp,
  centavosParaReais,
  formatBRL,
  formatDecimalBR,
  parseBRL,
  percentual,
  percentualBp,
  percentualDe,
  reaisParaCentavos,
  somar,
  subtrair,
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
