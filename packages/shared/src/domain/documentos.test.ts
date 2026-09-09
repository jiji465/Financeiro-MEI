import { describe, expect, it } from 'vitest';

import {
  calcularDvCNPJ,
  formatarCNPJ,
  formatarCPF,
  formatarDocumento,
  normalizarDocumento,
  tipoDocumento,
  validarCNPJ,
  validarCPF,
  validarDocumento,
} from './documentos.js';

describe('normalizarDocumento', () => {
  it.each([
    ['529.982.247-25', '52998224725'],
    ['12.abc.345/01de-35', '12ABC34501DE35'],
    [' 11 222 333 0001 81 ', '11222333000181'],
    ['', ''],
  ])('%s → %s', (entrada, esperado) => {
    expect(normalizarDocumento(entrada)).toBe(esperado);
  });

  it('devolve vazio para entrada que não é string', () => {
    expect(normalizarDocumento(123 as unknown as string)).toBe('');
  });
});

describe('validarCPF', () => {
  it.each([
    ['529.982.247-25', true],
    ['52998224725', true],
    ['111.444.777-35', true],
    ['111.111.111-11', false], // sequência repetida
    ['000.000.000-00', false],
    ['529.982.247-26', false], // DV2 errado
    ['529.982.248-25', false], // DV1 errado
    ['5299822472', false], // 10 dígitos
    ['529982247255', false], // 12 dígitos
    ['abc', false],
    ['', false],
  ])('%s → %s', (cpf, esperado) => {
    expect(validarCPF(cpf)).toBe(esperado);
  });
});

describe('validarCNPJ', () => {
  it.each([
    ['11.222.333/0001-81', true],
    ['11222333000181', true],
    ['12.345.678/0001-95', true],
    ['12.ABC.345/01DE-35', true], // exemplo alfanumérico da Receita Federal
    ['12.abc.345/01de-35', true], // minúsculas normalizadas
    ['12.ABC.345/01DE-36', false],
    ['11.222.333/0001-82', false],
    ['00.000.000/0000-00', false],
    ['AAAAAAAAAAAA00', false], // base repetida
    ['11.222.333/0001-8', false], // 13 chars
    ['11.222.333/0001-81X', false],
    ['12.ABC.345/01DE-3A', false], // DV precisa ser numérico
    ['', false],
  ])('%s → %s', (cnpj, esperado) => {
    expect(validarCNPJ(cnpj)).toBe(esperado);
  });

  it('calcularDvCNPJ calcula os dígitos (charCode − 48, pesos 5..2 / 6..2)', () => {
    expect(calcularDvCNPJ('123456780001')).toBe('95');
    expect(calcularDvCNPJ('12ABC34501DE')).toBe('35');
    expect(calcularDvCNPJ('11.222.333/0001')).toBe('81');
  });

  it('calcularDvCNPJ rejeita base inválida', () => {
    expect(() => calcularDvCNPJ('123')).toThrow(RangeError);
    expect(() => calcularDvCNPJ('12345678000ç')).toThrow(RangeError);
  });
});

describe('tipoDocumento / validarDocumento', () => {
  it.each([
    ['529.982.247-25', 'cpf'],
    ['11.222.333/0001-81', 'cnpj'],
    ['12.ABC.345/01DE-35', 'cnpj'],
    ['529.982.247-26', null],
    ['11.222.333/0001-82', null],
    ['123', null],
    ['', null],
  ])('%s → %s', (doc, esperado) => {
    expect(tipoDocumento(doc)).toBe(esperado);
    expect(validarDocumento(doc)).toBe(esperado !== null);
  });
});

describe('formatação', () => {
  it('formatarCPF', () => {
    expect(formatarCPF('52998224725')).toBe('529.982.247-25');
    expect(formatarCPF('529.982.247-25')).toBe('529.982.247-25');
    expect(formatarCPF('5299')).toBe('529.9');
    expect(formatarCPF('5299822')).toBe('529.982.2');
    expect(formatarCPF('529982247')).toBe('529.982.247');
    expect(formatarCPF('5299822472599')).toBe('529.982.247-25');
    expect(formatarCPF('')).toBe('');
  });

  it('formatarCNPJ', () => {
    expect(formatarCNPJ('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatarCNPJ('12abc34501de35')).toBe('12.ABC.345/01DE-35');
    expect(formatarCNPJ('112')).toBe('11.2');
    expect(formatarCNPJ('112223')).toBe('11.222.3');
    expect(formatarCNPJ('1122233300')).toBe('11.222.333/00');
    expect(formatarCNPJ('1122233300018199')).toBe('11.222.333/0001-81');
  });

  it('formatarDocumento escolhe pelo tamanho', () => {
    expect(formatarDocumento('52998224725')).toBe('529.982.247-25');
    expect(formatarDocumento('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatarDocumento('12ABC34501DE35')).toBe('12.ABC.345/01DE-35');
    expect(formatarDocumento('123')).toBe('123');
    expect(formatarDocumento('5299822472A')).toBe('5299822472A');
  });
});
