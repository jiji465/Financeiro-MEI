import { describe, expect, it } from 'vitest';

import {
  arredondarHalfUp,
  formatBRL,
  parseBRL,
  percentualBp,
  percentualDe,
  reaisParaCentavos,
  somar,
} from './money.js';

describe('formatBRL', () => {
  it('formata centavos no padrão brasileiro', () => {
    expect(formatBRL(123456)).toBe('R$ 1.234,56');
    expect(formatBRL(0)).toBe('R$ 0,00');
    expect(formatBRL(5)).toBe('R$ 0,05');
    expect(formatBRL(-1050)).toBe('-R$ 10,50');
  });

  it('rejeita valores não inteiros', () => {
    expect(() => formatBRL(10.5)).toThrow(TypeError);
  });
});

describe('parseBRL', () => {
  it.each([
    ['R$ 1.234,56', 123456],
    ['1234,56', 123456],
    ['1.234', 123400],
    ['1234.56', 123456],
    ['12,5', 1250],
    ['0,05', 5],
    ['-12,50', -1250],
    ['(12,50)', -1250],
    ['  R$ 10  ', 1000],
  ])('converte %s em %i centavos', (texto, esperado) => {
    expect(parseBRL(texto)).toBe(esperado);
  });

  it('retorna null para entradas inválidas', () => {
    expect(parseBRL('')).toBeNull();
    expect(parseBRL('abc')).toBeNull();
    expect(parseBRL('1,2,3')).toBeNull();
    expect(parseBRL('1,234')).toBeNull();
  });
});

describe('somar', () => {
  it('soma centavos', () => {
    expect(somar(100, 250, -50)).toBe(300);
    expect(somar()).toBe(0);
  });

  it('rejeita frações', () => {
    expect(() => somar(1, 0.1)).toThrow(TypeError);
  });
});

describe('percentualBp', () => {
  it('aplica basis points com arredondamento half-up', () => {
    expect(percentualBp(162100, 500)).toBe(8105); // INSS 5% do salário mínimo 2026
    expect(percentualBp(162100, 1200)).toBe(19452); // caminhoneiro 12%
    expect(percentualBp(1000, 2000)).toBe(200);
    expect(percentualBp(101, 50)).toBe(1); // 0,505 → 1
    expect(percentualBp(-101, 50)).toBe(-1);
  });
});

describe('utilitários', () => {
  it('percentualDe', () => {
    expect(percentualDe(6_400_000, 8_100_000)).toBe(79.01);
    expect(percentualDe(10, 0)).toBe(0);
  });

  it('arredondarHalfUp', () => {
    expect(arredondarHalfUp(2.5)).toBe(3);
    expect(arredondarHalfUp(-2.5)).toBe(-3);
    expect(arredondarHalfUp(2.4)).toBe(2);
  });

  it('reaisParaCentavos', () => {
    expect(reaisParaCentavos(19.99)).toBe(1999);
    expect(reaisParaCentavos(0.1 + 0.2)).toBe(30);
  });
});
