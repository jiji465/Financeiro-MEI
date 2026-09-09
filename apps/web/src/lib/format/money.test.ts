import { describe, expect, it } from 'vitest';

import {
  formatBRL,
  formatBRLCompact,
  formatBRLComSinal,
  formatCentavos,
  formatPercentual,
  parseBRL,
} from './money';

describe('formatBRL / formatCentavos', () => {
  it('formata centavos em reais', () => {
    expect(formatBRL(123456)).toBe('R$ 1.234,56');
    expect(formatBRL(0)).toBe('R$ 0,00');
    expect(formatBRL(-500)).toBe('-R$ 5,00');
    expect(formatCentavos(123456)).toBe('1.234,56');
    expect(formatCentavos(5)).toBe('0,05');
  });

  it('sinal explícito', () => {
    expect(formatBRLComSinal(1000)).toBe('+R$ 10,00');
    expect(formatBRLComSinal(-1000)).toBe('−R$ 10,00');
    expect(formatBRLComSinal(0)).toBe('R$ 0,00');
  });

  it('compacto', () => {
    expect(formatBRLCompact(85000)).toBe('R$ 850');
    expect(formatBRLCompact(123456)).toBe('R$ 1,2 mil');
    expect(formatBRLCompact(345678900)).toBe('R$ 3,5 mi');
    expect(formatBRLCompact(-150000)).toBe('−R$ 1,5 mil');
  });

  it('percentual', () => {
    expect(formatPercentual(12.5)).toBe('12,5%');
    expect(formatPercentual(100)).toBe('100%');
    expect(formatPercentual(33.333, 2)).toBe('33,33%');
  });
});

describe('parseBRL', () => {
  it.each([
    ['R$ 1.234,56', 123456],
    ['1234,56', 123456],
    ['1234.56', 123456],
    ['1.234', 123400],
    ['1234', 123400],
    ['-12,5', -1250],
    ['0,1', 10],
    ['', null],
    ['abc', null],
    ['1,234,56', null],
  ])('parseBRL(%s) → %s', (entrada, esperado) => {
    expect(parseBRL(entrada)).toBe(esperado);
  });
});
