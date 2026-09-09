import { describe, expect, it } from 'vitest';

import { distribuirValor, gerarParcelas, somarParcelas, validarListaParcelas } from './parcelas.js';

describe('distribuirValor', () => {
  it('base em todas e resto na última', () => {
    expect(distribuirValor(10_000, 3)).toEqual([3333, 3333, 3334]);
    expect(distribuirValor(100, 3)).toEqual([33, 33, 34]);
    expect(distribuirValor(1, 3)).toEqual([0, 0, 1]);
    expect(distribuirValor(9000, 3)).toEqual([3000, 3000, 3000]);
    expect(distribuirValor(500, 1)).toEqual([500]);
  });

  it('invariante Σ = total para vários casos', () => {
    for (const total of [1, 7, 99, 12_345, 1_000_001]) {
      for (const n of [1, 2, 3, 7, 12, 48]) {
        const partes = distribuirValor(total, n);
        expect(partes).toHaveLength(n);
        expect(partes.reduce((a, b) => a + b, 0)).toBe(total);
      }
    }
  });

  it('rejeita entradas inválidas', () => {
    expect(() => distribuirValor(0, 3)).toThrow(RangeError);
    expect(() => distribuirValor(-10, 3)).toThrow(RangeError);
    expect(() => distribuirValor(10.5, 3)).toThrow(TypeError);
    expect(() => distribuirValor(100, 0)).toThrow(RangeError);
    expect(() => distribuirValor(100, 1.5)).toThrow(RangeError);
  });
});

describe('gerarParcelas', () => {
  it('vencimentos mensais com clamp de fim de mês, relativo ao primeiro', () => {
    expect(gerarParcelas(10_000, 3, '2026-01-31')).toEqual([
      { numero: 1, vencimento: '2026-01-31', valor: 3333 },
      { numero: 2, vencimento: '2026-02-28', valor: 3333 },
      { numero: 3, vencimento: '2026-03-31', valor: 3334 },
    ]);
  });

  it('mantém o dia quando existe e vira o ano', () => {
    expect(gerarParcelas(300, 3, '2026-11-15').map((p) => p.vencimento)).toEqual([
      '2026-11-15',
      '2026-12-15',
      '2027-01-15',
    ]);
  });

  it('uma parcela só', () => {
    expect(gerarParcelas(999, 1, '2026-05-05')).toEqual([
      { numero: 1, vencimento: '2026-05-05', valor: 999 },
    ]);
  });
});

describe('validarListaParcelas / somarParcelas', () => {
  it('valida soma e positividade', () => {
    expect(somarParcelas([{ valor: 1 }, { valor: 2 }])).toBe(3);
    expect(validarListaParcelas([{ valor: 50 }, { valor: 50 }], 100)).toBe(true);
    expect(validarListaParcelas([{ valor: 50 }, { valor: 49 }], 100)).toBe(false);
    expect(validarListaParcelas([{ valor: 100 }, { valor: 0 }], 100)).toBe(false);
    expect(validarListaParcelas([], 0)).toBe(false);
  });
});
