import { describe, expect, it } from 'vitest';

import {
  contarDiasUteis,
  diaUtilAnterior,
  ehDiaUtil,
  ehFeriado,
  feriadoEm,
  feriadosNacionais,
  pascoa,
  proximoDiaUtil,
} from './calendario.js';

describe('pascoa (Meeus/Jones/Butcher)', () => {
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2028, '2028-04-16'],
    [2029, '2029-04-01'],
    [2030, '2030-04-21'],
  ])('%i → %s', (ano, esperado) => {
    expect(pascoa(ano)).toBe(esperado);
  });

  it('rejeita anos inválidos', () => {
    expect(() => pascoa(1500)).toThrow(RangeError);
    expect(() => pascoa(2026.5)).toThrow(RangeError);
  });
});

describe('feriadosNacionais', () => {
  it('lista fixos + móveis de 2026 em ordem', () => {
    const datas = feriadosNacionais(2026).map((f) => f.data);
    expect(datas).toEqual([
      '2026-01-01',
      '2026-02-16', // Carnaval (segunda)
      '2026-02-17', // Carnaval (terça)
      '2026-04-03', // Sexta-feira Santa
      '2026-04-21',
      '2026-05-01',
      '2026-06-04', // Corpus Christi
      '2026-09-07',
      '2026-10-12',
      '2026-11-02',
      '2026-11-15',
      '2026-11-20',
      '2026-12-25',
    ]);
  });

  it('marca os móveis e cacheia o resultado', () => {
    const lista = feriadosNacionais(2026);
    expect(lista.filter((f) => f.movel).map((f) => f.nome)).toEqual([
      'Carnaval (segunda-feira)',
      'Carnaval (terça-feira)',
      'Sexta-feira Santa',
      'Corpus Christi',
    ]);
    expect(feriadosNacionais(2026)).toBe(lista);
  });

  it('Consciência Negra é nacional só a partir de 2024', () => {
    expect(feriadosNacionais(2023).some((f) => f.data === '2023-11-20')).toBe(false);
    expect(feriadosNacionais(2024).some((f) => f.data === '2024-11-20')).toBe(true);
  });

  it('feriadoEm / ehFeriado', () => {
    expect(feriadoEm('2026-04-21')?.nome).toBe('Tiradentes');
    expect(feriadoEm('2026-04-22')).toBeNull();
    expect(ehFeriado('2025-04-18')).toBe(true); // Sexta Santa 2025
    expect(ehFeriado('2025-04-19')).toBe(false);
  });
});

describe('dias úteis', () => {
  it('ehDiaUtil considera fim de semana e feriado', () => {
    expect(ehDiaUtil('2026-09-09')).toBe(true); // quarta
    expect(ehDiaUtil('2026-09-12')).toBe(false); // sábado
    expect(ehDiaUtil('2026-09-13')).toBe(false); // domingo
    expect(ehDiaUtil('2026-09-07')).toBe(false); // feriado (segunda)
  });

  it.each([
    ['2026-09-09', '2026-09-09'], // já é útil
    ['2026-09-19', '2026-09-21'], // sábado → segunda
    ['2026-09-20', '2026-09-21'], // domingo → segunda
    ['2026-11-20', '2026-11-23'], // sexta feriado → sábado → domingo → segunda
    ['2025-04-20', '2025-04-22'], // domingo de Páscoa → Tiradentes (segunda) → terça
    ['2026-02-14', '2026-02-18'], // sábado → domingo → Carnaval (seg/ter) → quarta
  ])('proximoDiaUtil(%s) = %s', (data, esperado) => {
    expect(proximoDiaUtil(data)).toBe(esperado);
  });

  it.each([
    ['2026-09-09', '2026-09-09'],
    ['2026-11-22', '2026-11-19'], // domingo → sábado → sexta feriado → quinta
    ['2026-01-01', '2025-12-31'],
  ])('diaUtilAnterior(%s) = %s', (data, esperado) => {
    expect(diaUtilAnterior(data)).toBe(esperado);
  });

  it('contarDiasUteis', () => {
    expect(contarDiasUteis('2026-11-16', '2026-11-22')).toBe(4); // 16-19; 20 feriado; 21-22 fds
    expect(contarDiasUteis('2026-09-09', '2026-09-09')).toBe(1);
    expect(contarDiasUteis('2026-09-10', '2026-09-09')).toBe(0);
  });
});
