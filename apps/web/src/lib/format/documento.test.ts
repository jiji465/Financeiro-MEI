import { describe, expect, it } from 'vitest';

import {
  formatDocumento,
  isValidCNPJ,
  isValidCPF,
  isValidCPFouCNPJ,
  maskCNPJ,
  maskCPF,
  maskCPFouCNPJ,
  normalizarCNPJ,
  onlyDigits,
  tipoDocumento,
} from './documento';

describe('CPF', () => {
  it.each([
    ['529.982.247-25', true],
    ['52998224725', true],
    ['111.111.111-11', false],
    ['529.982.247-24', false],
    ['1234567890', false],
    ['', false],
    [null, false],
  ])('isValidCPF(%s) → %s', (entrada, esperado) => {
    expect(isValidCPF(entrada)).toBe(esperado);
  });

  it('aplica a máscara progressivamente', () => {
    expect(maskCPF('5')).toBe('5');
    expect(maskCPF('5299')).toBe('529.9');
    expect(maskCPF('5299822')).toBe('529.982.2');
    expect(maskCPF('52998224725')).toBe('529.982.247-25');
    expect(maskCPF('529982247259999')).toBe('529.982.247-25');
  });
});

describe('CNPJ', () => {
  it.each([
    ['11.222.333/0001-81', true],
    ['11222333000181', true],
    ['11222333000180', false],
    ['00000000000000', false],
    ['12.ABC.345/01DE-35', true], // exemplo oficial do CNPJ alfanumérico
    ['12ABC34501DE35', true],
    ['12abc34501de35', true],
    ['12ABC34501DE34', false],
    ['12ABC34501DE', false],
    ['12ABC34501DEAB', false], // DV precisa ser numérico
  ])('isValidCNPJ(%s) → %s', (entrada, esperado) => {
    expect(isValidCNPJ(entrada)).toBe(esperado);
  });

  it('mascara numérico e alfanumérico', () => {
    expect(maskCNPJ('11222333000181')).toBe('11.222.333/0001-81');
    expect(maskCNPJ('12abc34501de35')).toBe('12.ABC.345/01DE-35');
    expect(maskCNPJ('112223')).toBe('11.222.3');
  });

  it('normaliza para 14 caracteres maiúsculos', () => {
    expect(normalizarCNPJ('12.abc.345/01de-35')).toBe('12ABC34501DE35');
    expect(onlyDigits('11.222.333/0001-81')).toBe('11222333000181');
  });
});

describe('CPF ou CNPJ', () => {
  it('decide a máscara pelo tamanho/conteúdo', () => {
    expect(maskCPFouCNPJ('52998224725')).toBe('529.982.247-25');
    expect(maskCPFouCNPJ('112223330001')).toBe('11.222.333/0001');
    expect(maskCPFouCNPJ('12ABC')).toBe('12.ABC');
  });

  it('valida qualquer um dos dois', () => {
    expect(isValidCPFouCNPJ('529.982.247-25')).toBe(true);
    expect(isValidCPFouCNPJ('11.222.333/0001-81')).toBe(true);
    expect(isValidCPFouCNPJ('529.982.247-24')).toBe(false);
  });

  it('identifica e formata para exibição', () => {
    expect(tipoDocumento('52998224725')).toBe('cpf');
    expect(tipoDocumento('11222333000181')).toBe('cnpj');
    expect(tipoDocumento('123')).toBeNull();
    expect(formatDocumento('52998224725')).toBe('529.982.247-25');
    expect(formatDocumento('abc')).toBe('abc');
  });
});
