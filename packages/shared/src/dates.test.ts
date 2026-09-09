import { describe, expect, it } from 'vitest';

import { addMonthsClamp, hojeSP, isIsoDate, toIsoDate, ultimoDiaDoMes } from './dates.js';

describe('hojeSP', () => {
  it('usa o fuso de São Paulo, não UTC', () => {
    // 2026-03-01T01:30Z ainda é 28/02 (ou 29/02 em bissexto) em São Paulo (UTC-3)
    expect(hojeSP(new Date('2026-03-01T01:30:00Z'))).toBe('2026-02-28');
    expect(hojeSP(new Date('2026-03-01T03:00:00Z'))).toBe('2026-03-01');
  });

  it('toIsoDate aceita outro fuso', () => {
    expect(toIsoDate(new Date('2026-03-01T01:30:00Z'), 'UTC')).toBe('2026-03-01');
  });
});

describe('addMonthsClamp', () => {
  it('mantém o dia quando existe', () => {
    expect(addMonthsClamp('2026-01-15', 1)).toBe('2026-02-15');
    expect(addMonthsClamp('2026-11-15', 2)).toBe('2027-01-15');
    expect(addMonthsClamp('2026-01-15', -1)).toBe('2025-12-15');
  });

  it('gruda no fim do mês quando o dia não existe', () => {
    expect(addMonthsClamp('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsClamp('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonthsClamp('2026-03-31', 1)).toBe('2026-04-30');
  });
});

describe('validação', () => {
  it('isIsoDate', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('28/02/2026')).toBe(false);
    expect(isIsoDate(20260228)).toBe(false);
  });

  it('ultimoDiaDoMes', () => {
    expect(ultimoDiaDoMes('2026-02-10')).toBe('2026-02-28');
    expect(ultimoDiaDoMes('2024-02-10')).toBe('2024-02-29');
  });
});
