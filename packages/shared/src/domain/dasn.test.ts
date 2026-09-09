import { describe, expect, it } from 'vitest';

import { apurarFaturamento, checarDasn, dasPendentesDasn, janelaDasn, prazoDasn } from './dasn.js';

describe('prazoDasn', () => {
  it('31/05 do ano seguinte por padrão', () => {
    expect(prazoDasn(2025)).toBe('2026-05-31');
    expect(prazoDasn(2026)).toBe('2027-05-31');
  });

  it('respeita parâmetros', () => {
    expect(prazoDasn(2025, { dasnPrazoDia: 30, dasnPrazoMes: 6 })).toBe('2026-06-30');
  });
});

describe('janelaDasn', () => {
  it('futura antes de 01/01 do ano seguinte', () => {
    const j = janelaDasn(2026, '2026-09-09');
    expect(j).toMatchObject({
      anoBase: 2026,
      abertura: '2027-01-01',
      prazo: '2027-05-31',
      aberta: false,
      atrasada: false,
      situacao: 'futura',
    });
    expect(j.diasParaPrazo).toBe(264);
  });

  it('aberta entre 01/01 e o prazo', () => {
    const j = janelaDasn(2025, '2026-05-31');
    expect(j.situacao).toBe('aberta');
    expect(j.aberta).toBe(true);
    expect(j.diasParaPrazo).toBe(0);
  });

  it('atrasada após o prazo', () => {
    const j = janelaDasn(2025, '2026-06-01');
    expect(j.situacao).toBe('atrasada');
    expect(j.atrasada).toBe(true);
    expect(j.diasParaPrazo).toBe(-1);
  });
});

describe('apurarFaturamento', () => {
  it('separa comércio/serviços e destaca receitas sem grupo', () => {
    const f = apurarFaturamento([
      { valor: 1000, grupoDasn: 'comercio' },
      { valor: 2000, grupoDasn: 'servicos' },
      { valor: 300, grupoDasn: 'comercio' },
      { valor: 50, grupoDasn: null },
    ]);
    expect(f).toEqual({
      total: 3350,
      comercio: 1300,
      servicos: 2000,
      semGrupo: 50,
      alertaSemGrupo: true,
    });
  });

  it('sem receitas', () => {
    expect(apurarFaturamento([])).toEqual({
      total: 0,
      comercio: 0,
      servicos: 0,
      semGrupo: 0,
      alertaSemGrupo: false,
    });
  });
});

describe('dasPendentesDasn / checarDasn', () => {
  it('lista competências devidas sem pagamento, ordenadas', () => {
    expect(dasPendentesDasn(['2025-03', '2025-01', '2025-02'], ['2025-02'])).toEqual([
      '2025-01',
      '2025-03',
    ]);
  });

  it('pronta para declarar só com janela aberta, sem DAS pendente e sem receita sem grupo', () => {
    const base = {
      anoBase: 2025,
      hoje: '2026-02-10',
      receitas: [{ valor: 1000, grupoDasn: 'comercio' as const }],
      competenciasDevidas: ['2025-11', '2025-12'],
      competenciasPagas: ['2025-11', '2025-12'],
    };
    expect(checarDasn(base).prontaParaDeclarar).toBe(true);
    expect(checarDasn({ ...base, competenciasPagas: ['2025-11'] })).toMatchObject({
      prontaParaDeclarar: false,
      dasPendentes: ['2025-12'],
    });
    expect(
      checarDasn({ ...base, receitas: [{ valor: 1, grupoDasn: null }] }).prontaParaDeclarar,
    ).toBe(false);
    expect(checarDasn({ ...base, hoje: '2025-12-31' }).prontaParaDeclarar).toBe(false);
    expect(
      checarDasn({ ...base, params: { dasnPrazoDia: 30, dasnPrazoMes: 6 } }).janela.prazo,
    ).toBe('2026-06-30');
  });
});
