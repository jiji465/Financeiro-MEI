import { describe, expect, it } from 'vitest';

import {
  addDias,
  addMesesCompetencia,
  addMonthsClamp,
  anoDe,
  competenciaDe,
  competenciasEntre,
  compararIsoDate,
  dentroDoPeriodo,
  diaDaSemana,
  diasEntre,
  diasNoAno,
  ehBissexto,
  ehFimDeSemana,
  fimAno,
  fimMes,
  formatData,
  formatMesAno,
  hojeSP,
  inicioAno,
  inicioMes,
  isCompetencia,
  isIsoDate,
  maxIsoDate,
  mesesEntre,
  minIsoDate,
  montarCompetencia,
  nomeDoMes,
  parseCompetencia,
  parseDataBR,
  parseIsoDate,
  primeiroDiaDoMes,
  toIsoDate,
  ultimoDiaDoMes,
} from './dates.js';

describe('hojeSP', () => {
  it('usa o fuso de São Paulo, não UTC', () => {
    // 2026-03-01T01:30Z ainda é 28/02 em São Paulo (UTC-3)
    expect(hojeSP(new Date('2026-03-01T01:30:00Z'))).toBe('2026-02-28');
    expect(hojeSP(new Date('2026-03-01T03:00:00Z'))).toBe('2026-03-01');
  });

  it('23:30 em São Paulo ainda é o mesmo dia; em UTC já é o seguinte', () => {
    const instante = new Date('2026-03-01T02:30:00Z'); // 23:30 de 28/02 em America/Sao_Paulo
    expect(hojeSP(instante)).toBe('2026-02-28');
    expect(toIsoDate(instante, 'UTC')).toBe('2026-03-01');
    expect(hojeSP(new Date('2026-03-01T02:59:59Z'))).toBe('2026-02-28');
  });

  it('aceita relógio injetável (função)', () => {
    const clock = () => new Date('2026-09-09T12:00:00Z');
    expect(hojeSP(clock)).toBe('2026-09-09');
  });

  it('toIsoDate aceita outro fuso', () => {
    expect(toIsoDate(new Date('2026-03-01T01:30:00Z'), 'UTC')).toBe('2026-03-01');
  });
});

describe('validação e parse', () => {
  it('isIsoDate', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-00-01')).toBe(false);
    expect(isIsoDate('28/02/2026')).toBe(false);
    expect(isIsoDate(20260228)).toBe(false);
  });

  it('isCompetencia', () => {
    expect(isCompetencia('2026-02')).toBe(true);
    expect(isCompetencia('2026-13')).toBe(false);
    expect(isCompetencia('2026-00')).toBe(false);
    expect(isCompetencia('2026-02-01')).toBe(false);
    expect(isCompetencia(202602)).toBe(false);
  });

  it('parseIsoDate / parseCompetencia sem deslocamento de fuso', () => {
    expect(parseIsoDate('2026-02-28')).toEqual({ ano: 2026, mes: 2, dia: 28 });
    expect(() => parseIsoDate('2026-02-30')).toThrow(RangeError);
    expect(parseCompetencia('2026-02')).toEqual({ ano: 2026, mes: 2 });
    expect(() => parseCompetencia('2026-2')).toThrow(RangeError);
    expect(montarCompetencia({ ano: 2026, mes: 2 })).toBe('2026-02');
  });

  it('parseDataBR', () => {
    expect(parseDataBR('28/02/2026')).toBe('2026-02-28');
    expect(parseDataBR('1/3/2026')).toBe('2026-03-01');
    expect(parseDataBR('28-02-2026')).toBe('2026-02-28');
    expect(parseDataBR('28.02.26')).toBe('2026-02-28');
    expect(parseDataBR('28/02/99')).toBe('1999-02-28');
    expect(parseDataBR('30/02/2026')).toBeNull();
    expect(parseDataBR('2026-02-28')).toBeNull();
    expect(parseDataBR('abc')).toBeNull();
    expect(parseDataBR(123 as unknown as string)).toBeNull();
  });
});

describe('aritmética', () => {
  it('addMonthsClamp mantém o dia quando existe', () => {
    expect(addMonthsClamp('2026-01-15', 1)).toBe('2026-02-15');
    expect(addMonthsClamp('2026-11-15', 2)).toBe('2027-01-15');
    expect(addMonthsClamp('2026-01-15', -1)).toBe('2025-12-15');
  });

  it('addMonthsClamp gruda no fim do mês quando o dia não existe', () => {
    expect(addMonthsClamp('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsClamp('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonthsClamp('2026-03-31', 1)).toBe('2026-04-30');
  });

  it('addDias e addMesesCompetencia', () => {
    expect(addDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDias('2026-03-01', -1)).toBe('2026-02-28');
    expect(addMesesCompetencia('2026-12', 1)).toBe('2027-01');
    expect(addMesesCompetencia('2026-01', -1)).toBe('2025-12');
  });

  it('diasEntre / mesesEntre / competenciasEntre', () => {
    expect(diasEntre('2026-01-01', '2026-12-31')).toBe(364);
    expect(diasEntre('2026-03-01', '2026-02-28')).toBe(-1);
    expect(mesesEntre('2026-01-15', '2026-12-01')).toBe(11);
    expect(mesesEntre('2026-01', '2027-01')).toBe(12);
    expect(mesesEntre('2026-03-31', '2026-01')).toBe(-2);
    expect(competenciasEntre('2026-11', '2027-01')).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(competenciasEntre('2026-02', '2026-01')).toEqual([]);
  });

  it('inicio/fim de mês e ano', () => {
    expect(primeiroDiaDoMes('2026-02-10')).toBe('2026-02-01');
    expect(ultimoDiaDoMes('2026-02-10')).toBe('2026-02-28');
    expect(ultimoDiaDoMes('2024-02-10')).toBe('2024-02-29');
    expect(inicioMes('2026-02-10')).toBe('2026-02-01');
    expect(inicioMes('2026-02')).toBe('2026-02-01');
    expect(fimMes('2026-02-10')).toBe('2026-02-28');
    expect(fimMes('2024-02')).toBe('2024-02-29');
    expect(inicioAno(2026)).toBe('2026-01-01');
    expect(fimAno(2026)).toBe('2026-12-31');
  });

  it('competenciaDe / anoDe / bissexto', () => {
    expect(competenciaDe('2026-09-09')).toBe('2026-09');
    expect(anoDe('2026-09-09')).toBe(2026);
    expect(ehBissexto(2024)).toBe(true);
    expect(ehBissexto(2100)).toBe(false);
    expect(ehBissexto(2000)).toBe(true);
    expect(diasNoAno(2026)).toBe(365);
    expect(diasNoAno(2028)).toBe(366);
  });

  it('dia da semana', () => {
    expect(diaDaSemana('2026-09-09')).toBe(3); // quarta
    expect(ehFimDeSemana('2026-09-12')).toBe(true);
    expect(ehFimDeSemana('2026-09-13')).toBe(true);
    expect(ehFimDeSemana('2026-09-14')).toBe(false);
  });

  it('comparações', () => {
    expect(compararIsoDate('2026-01-01', '2026-01-02')).toBe(-1);
    expect(compararIsoDate('2026-01-02', '2026-01-01')).toBe(1);
    expect(compararIsoDate('2026-01-01', '2026-01-01')).toBe(0);
    expect(maxIsoDate('2026-01-01', '2026-01-02')).toBe('2026-01-02');
    expect(minIsoDate('2026-01-01', '2026-01-02')).toBe('2026-01-01');
    expect(dentroDoPeriodo('2026-01-15', '2026-01-01', '2026-01-31')).toBe(true);
    expect(dentroDoPeriodo('2026-02-01', '2026-01-01', '2026-01-31')).toBe(false);
  });
});

describe('formatação', () => {
  it('formatData dd/MM/yyyy', () => {
    expect(formatData('2026-02-05')).toBe('05/02/2026');
  });

  it('formatMesAno e nomeDoMes', () => {
    expect(formatMesAno('2026-03-15')).toBe('Março/2026');
    expect(formatMesAno('2026-03')).toBe('Março/2026');
    expect(formatMesAno('2026-03', true)).toBe('Mar/2026');
    expect(nomeDoMes(1)).toBe('Janeiro');
    expect(nomeDoMes(12, true)).toBe('Dez');
    expect(() => nomeDoMes(13)).toThrow(RangeError);
  });
});
