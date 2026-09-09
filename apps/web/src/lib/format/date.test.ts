import { describe, expect, it } from 'vitest';

import {
  addDias,
  descreverPrazo,
  diaDaSemana,
  diasAte,
  formatData,
  formatDataExtenso,
  formatDataHora,
  formatMesAno,
  formatMesExtenso,
  parseDataBR,
  periodoPreset,
  presetDoPeriodo,
} from './date';

describe('formatData', () => {
  it('formata ISO sem deslocamento de fuso', () => {
    expect(formatData('2026-03-05')).toBe('05/03/2026');
    expect(formatData('2026-01-01')).toBe('01/01/2026');
    expect(formatData('2026-12-31')).toBe('31/12/2026');
  });

  it('timestamps são convertidos para a data em São Paulo', () => {
    // 02:30Z é 23:30 do dia anterior no Brasil
    expect(formatData('2026-03-05T02:30:00.000Z')).toBe('04/03/2026');
    expect(formatDataHora('2026-03-05T02:30:00.000Z')).toBe('04/03/2026 23:30');
  });

  it('valores inválidos viram vazio', () => {
    expect(formatData('')).toBe('');
    expect(formatData(null)).toBe('');
    expect(formatData('2026-02-30')).toBe('');
    expect(formatData('abc')).toBe('');
  });

  it('extenso e competência', () => {
    expect(formatDataExtenso('2026-03-05')).toBe('5 de março de 2026');
    expect(formatMesAno('2026-03')).toBe('mar/2026');
    expect(formatMesAno('2026-03-05')).toBe('mar/2026');
    expect(formatMesExtenso('2026-03')).toBe('março de 2026');
    expect(formatMesAno('')).toBe('');
  });

  it('dia da semana', () => {
    expect(diaDaSemana('2026-03-05')).toBe('quinta-feira');
  });
});

describe('diasAte / addDias', () => {
  it('conta dias entre datas ISO', () => {
    expect(diasAte('2026-03-20', '2026-03-15')).toBe(5);
    expect(diasAte('2026-03-10', '2026-03-15')).toBe(-5);
    expect(diasAte('2026-03-15', '2026-03-15')).toBe(0);
  });

  it('descreve o prazo', () => {
    expect(descreverPrazo('2026-03-15', '2026-03-15')).toBe('hoje');
    expect(descreverPrazo('2026-03-16', '2026-03-15')).toBe('amanhã');
    expect(descreverPrazo('2026-03-14', '2026-03-15')).toBe('ontem');
    expect(descreverPrazo('2026-03-20', '2026-03-15')).toBe('em 5 dias');
    expect(descreverPrazo('2026-03-10', '2026-03-15')).toBe('há 5 dias');
  });

  it('soma dias atravessando o mês', () => {
    expect(addDias('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDias('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('parseDataBR', () => {
  it('converte dd/MM/yyyy', () => {
    expect(parseDataBR('05/03/2026')).toBe('2026-03-05');
    expect(parseDataBR('5/3/2026')).toBe('2026-03-05');
    expect(parseDataBR('31/02/2026')).toBeNull();
    expect(parseDataBR('2026-03-05')).toBeNull();
  });
});

describe('periodoPreset', () => {
  const hoje = '2026-03-15';

  it('calcula os presets', () => {
    expect(periodoPreset('este_mes', hoje)).toEqual({ de: '2026-03-01', ate: '2026-03-31' });
    expect(periodoPreset('mes_passado', hoje)).toEqual({ de: '2026-02-01', ate: '2026-02-28' });
    expect(periodoPreset('ultimos_30_dias', hoje)).toEqual({ de: '2026-02-14', ate: '2026-03-15' });
    expect(periodoPreset('este_ano', hoje)).toEqual({ de: '2026-01-01', ate: '2026-12-31' });
    expect(periodoPreset('ano_passado', hoje)).toEqual({ de: '2025-01-01', ate: '2025-12-31' });
  });

  it('mês passado em janeiro volta ao ano anterior', () => {
    expect(periodoPreset('mes_passado', '2026-01-10')).toEqual({
      de: '2025-12-01',
      ate: '2025-12-31',
    });
  });

  it('descobre o preset de um intervalo', () => {
    expect(presetDoPeriodo({ de: '2026-03-01', ate: '2026-03-31' }, hoje)).toBe('este_mes');
    expect(presetDoPeriodo({ de: '2026-03-02', ate: '2026-03-31' }, hoje)).toBe('personalizado');
  });
});
