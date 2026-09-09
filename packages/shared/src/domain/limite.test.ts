import { describe, expect, it } from 'vitest';

import {
  acumularReceitas,
  classificarExcesso,
  inicioConsiderado,
  limiteAplicavel,
  marcasLimite,
  nivelLimite,
  type ParametrosLimite,
  situacaoLimite,
  toleranciaLimite,
} from './limite.js';

const PARAMS: ParametrosLimite = {
  limiteAnual: 8_100_000,
  limiteMensalProporcional: 675_000,
  toleranciaExcessoBp: 2000,
  alertasLimitePct: [70, 85, 100],
};

describe('limiteAplicavel', () => {
  it('ano cheio usa o limite anual', () => {
    expect(limiteAplicavel(PARAMS, 2026, null)).toBe(8_100_000);
    expect(limiteAplicavel(PARAMS, 2026, undefined)).toBe(8_100_000);
    expect(limiteAplicavel(PARAMS, 2026, '2025-03-10')).toBe(8_100_000);
  });

  it('ano de abertura é proporcional: abertura em março → 10 meses × 6.750,00', () => {
    expect(limiteAplicavel(PARAMS, 2026, '2026-03-10')).toBe(6_750_000);
    expect(limiteAplicavel(PARAMS, 2026, '2026-01-01')).toBe(8_100_000);
    expect(limiteAplicavel(PARAMS, 2026, '2026-12-31')).toBe(675_000);
  });

  it('tolerância = limite × 1,20', () => {
    expect(toleranciaLimite(PARAMS, 8_100_000)).toBe(9_720_000);
    expect(toleranciaLimite(PARAMS, 6_750_000)).toBe(8_100_000);
  });
});

describe('nivelLimite / classificarExcesso', () => {
  it.each([
    [0, 'ok'],
    [69.99, 'ok'],
    [70, 'atencao'],
    [84.99, 'atencao'],
    [85, 'alerta'],
    [99.99, 'alerta'],
    [100, 'estourado'],
    [150, 'estourado'],
  ])('%s%% → %s', (pct, esperado) => {
    expect(nivelLimite(pct)).toBe(esperado);
  });

  it('aceita marcas customizadas e usa padrão quando faltam', () => {
    expect(nivelLimite(50, [50, 75, 100])).toBe('atencao');
    expect(nivelLimite(90, [])).toBe('alerta');
  });

  it('excesso: 100% → nenhum; 120% → ate_20; 120% + 1 centavo → acima_20', () => {
    expect(classificarExcesso(8_100_000, 8_100_000, 9_720_000)).toBeNull();
    expect(classificarExcesso(8_100_001, 8_100_000, 9_720_000)).toBe('ate_20');
    expect(classificarExcesso(9_720_000, 8_100_000, 9_720_000)).toBe('ate_20');
    expect(classificarExcesso(9_720_001, 8_100_000, 9_720_000)).toBe('acima_20');
  });
});

describe('acumularReceitas', () => {
  const receitas = [
    { data: '2026-01-10', dataPagamento: '2026-01-10', status: 'pago', valor: 100 },
    { data: '2026-02-10', dataPagamento: null, status: 'pendente', valor: 200 },
    { data: '2025-12-31', dataPagamento: '2026-01-05', status: 'pago', valor: 400 }, // vira o ano no caixa
    { data: '2026-12-31', dataPagamento: '2027-01-02', status: 'pago', valor: 800 }, // sai do ano no caixa
    { data: '2026-03-01', dataPagamento: null, status: 'pago', valor: 1600 }, // pago sem data de pagamento
    { data: '2025-06-01', dataPagamento: '2025-06-01', status: 'pago', valor: 3200 }, // outro ano
  ] as const;

  it('competência: pela data, pagas e pendentes', () => {
    expect(acumularReceitas(receitas, 'competencia', 2026)).toBe(100 + 200 + 800 + 1600);
  });

  it('caixa: por coalesce(dataPagamento, data), só pagas', () => {
    expect(acumularReceitas(receitas, 'caixa', 2026)).toBe(100 + 400 + 1600);
  });
});

describe('situacaoLimite', () => {
  it('100% do limite: estourado, sem excesso', () => {
    const s = situacaoLimite({
      ano: 2026,
      params: PARAMS,
      dataAbertura: null,
      hoje: '2026-09-09',
      acumulado: 8_100_000,
    });
    expect(s.percentual).toBe(100);
    expect(s.nivel).toBe('estourado');
    expect(s.excesso).toBeNull();
    expect(s.valorExcedido).toBe(0);
    expect(s.restante).toBe(0);
    expect(s.consequencia).toBeNull();
    expect(s.projecaoExcede).toBe(true);
    expect(s.anoAbertura).toBe(false);
    expect(s.mesInicio).toBe(1);
    expect(s.mesesConsiderados).toBe(12);
  });

  it('120%: excesso até 20% (permanece MEI até 31/12)', () => {
    const s = situacaoLimite({
      ano: 2026,
      params: PARAMS,
      dataAbertura: null,
      hoje: '2026-09-09',
      acumulado: 9_720_000,
    });
    expect(s.percentual).toBe(120);
    expect(s.excesso).toBe('ate_20');
    expect(s.valorExcedido).toBe(1_620_000);
    expect(s.consequencia).toMatch(/até 20%/);
  });

  it('120% + 1 centavo: excesso acima de 20% (desenquadramento retroativo)', () => {
    const s = situacaoLimite({
      ano: 2026,
      params: PARAMS,
      dataAbertura: null,
      hoje: '2026-09-09',
      acumulado: 9_720_001,
    });
    expect(s.excesso).toBe('acima_20');
    expect(s.consequencia).toMatch(/retroativo/);
  });

  it('projeção é null com menos de 15 dias decorridos', () => {
    const s = situacaoLimite({
      ano: 2026,
      params: PARAMS,
      dataAbertura: null,
      hoje: '2026-01-14',
      acumulado: 500_000,
    });
    expect(s.diasDecorridos).toBe(14);
    expect(s.projecao).toBeNull();
    expect(s.projecaoPercentual).toBeNull();
    expect(s.projecaoExcede).toBe(false);
    expect(s.mediaMensal).toBe(500_000);
  });

  it('projeção linear a partir de 15 dias', () => {
    const s = situacaoLimite({
      ano: 2026,
      params: PARAMS,
      dataAbertura: null,
      hoje: '2026-07-01',
      acumulado: 4_050_000,
    });
    expect(s.diasDecorridos).toBe(182);
    expect(s.diasTotais).toBe(365);
    expect(s.projecao).toBe(8_122_253); // 4.050.000 / 182 × 365
    expect(s.projecaoPercentual).toBe(100.27);
    expect(s.projecaoExcede).toBe(true);
    expect(s.nivel).toBe('ok');
    expect(s.mediaMensal).toBe(578_571); // 7 meses (jan-jul)
  });

  it('exatamente 15 dias já projeta e respeita diasMinimosProjecao', () => {
    const base = { ano: 2026, params: PARAMS, dataAbertura: null, acumulado: 150_000 };
    expect(situacaoLimite({ ...base, hoje: '2026-01-15' }).projecao).toBe(3_650_000);
    expect(
      situacaoLimite({ ...base, hoje: '2026-01-15', diasMinimosProjecao: 16 }).projecao,
    ).toBeNull();
  });

  it('ano de abertura: limite proporcional e janela a partir da abertura', () => {
    const s = situacaoLimite({
      ano: 2026,
      params: PARAMS,
      dataAbertura: '2026-03-10',
      hoje: '2026-09-09',
      acumulado: 5_000_000,
    });
    expect(s.anoAbertura).toBe(true);
    expect(s.limite).toBe(6_750_000);
    expect(s.tolerancia).toBe(8_100_000);
    expect(s.mesInicio).toBe(3);
    expect(s.mesesConsiderados).toBe(10);
    expect(s.percentual).toBe(74.07);
    expect(s.nivel).toBe('atencao');
    expect(s.diasTotais).toBe(297); // 10/03 a 31/12
    expect(s.diasDecorridos).toBe(184); // 10/03 a 09/09
    expect(s.mediaMensal).toBe(714_286); // 7 meses (mar-set)
    expect(s.projecao).toBe(8_070_652);
    expect(s.projecaoExcede).toBe(true);
  });

  it('antes da abertura: nada decorrido', () => {
    const s = situacaoLimite({
      ano: 2026,
      params: PARAMS,
      dataAbertura: '2026-10-01',
      hoje: '2026-09-09',
      acumulado: 0,
    });
    expect(s.diasDecorridos).toBe(0);
    expect(s.mediaMensal).toBe(0);
    expect(s.projecao).toBeNull();
    expect(s.nivel).toBe('ok');
  });

  it('ano encerrado: janela inteira e projeção = acumulado', () => {
    const s = situacaoLimite({
      ano: 2026,
      params: PARAMS,
      dataAbertura: null,
      hoje: '2027-02-01',
      acumulado: 7_000_000,
    });
    expect(s.diasDecorridos).toBe(365);
    expect(s.projecao).toBe(7_000_000);
    expect(s.nivel).toBe('alerta');
    expect(s.restante).toBe(1_100_000);
  });

  it('ano bissexto conta 366 dias', () => {
    const s = situacaoLimite({
      ano: 2028,
      params: PARAMS,
      dataAbertura: null,
      hoje: '2028-12-31',
      acumulado: 0,
    });
    expect(s.diasTotais).toBe(366);
    expect(s.projecao).toBe(0);
  });
});

describe('auxiliares', () => {
  it('marcasLimite', () => {
    expect(marcasLimite(8_100_000)).toEqual([5_670_000, 6_885_000, 8_100_000]);
    expect(marcasLimite(1000, [50])).toEqual([500]);
  });

  it('inicioConsiderado', () => {
    expect(inicioConsiderado(2026, null)).toBe('2026-01-01');
    expect(inicioConsiderado(2026, '2026-03-10')).toBe('2026-03-01');
    expect(inicioConsiderado(2026, '2027-03-10')).toBe('2026-01-01');
  });
});
