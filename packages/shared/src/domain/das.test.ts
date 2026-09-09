import { describe, expect, it } from 'vitest';

import {
  calcularDas,
  competenciasDevidas,
  competenciasDoAno,
  detalhamentoDas,
  diasAtrasoDas,
  mesInicial,
  type ParametrosMei,
  selecionarParametros,
  statusDas,
  tributosDevidos,
  vencimentoDas,
} from './das.js';

const PARAMS_2026: ParametrosMei = {
  ano: 2026,
  salarioMinimo: 162_100,
  aliquotaInssBp: 500,
  aliquotaInssCaminhoneiroBp: 1200,
  icms: 100,
  iss: 500,
  limiteAnual: 8_100_000,
  limiteMensalProporcional: 675_000,
  toleranciaExcessoBp: 2000,
  diaVencimentoDas: 20,
  dasnPrazoDia: 31,
  dasnPrazoMes: 5,
  alertasLimitePct: [70, 85, 100],
};

const PARAMS_2025: ParametrosMei = { ...PARAMS_2026, ano: 2025, salarioMinimo: 151_800 };

describe('calcularDas (2026: salário mínimo R$ 1.621,00)', () => {
  it.each([
    ['comercio', null, 8105, 100, 0, 8205],
    ['servicos', null, 8105, 0, 500, 8605],
    ['comercio_servicos', null, 8105, 100, 500, 8705],
    ['caminhoneiro', 'icms', 19452, 100, 0, 19552],
    ['caminhoneiro', 'iss', 19452, 0, 500, 19952],
    ['caminhoneiro', 'ambos', 19452, 100, 500, 20052],
    ['caminhoneiro', null, 19452, 100, 0, 19552], // sem informar: assume ICMS
  ] as const)(
    '%s / %s → inss %i, icms %i, iss %i, total %i',
    (atividade, trib, inss, icms, iss, total) => {
      const det = calcularDas(PARAMS_2026, atividade, trib);
      expect(det).toEqual({
        inss,
        icms,
        iss,
        total,
        aliquotaInssBp: atividade === 'caminhoneiro' ? 1200 : 500,
        salarioMinimo: 162_100,
      });
    },
  );

  it('usa os parâmetros do ano informado (2025)', () => {
    expect(calcularDas(PARAMS_2025, 'servicos').total).toBe(7590 + 500);
  });

  it('tributosDevidos', () => {
    expect(tributosDevidos('comercio', null)).toEqual({ icms: true, iss: false });
    expect(tributosDevidos('caminhoneiro', undefined)).toEqual({ icms: true, iss: false });
  });

  it('detalhamentoDas só lista tributos devidos', () => {
    const linhas = detalhamentoDas(calcularDas(PARAMS_2026, 'servicos'));
    expect(linhas.map((l) => l.codigo)).toEqual(['inss', 'iss']);
    expect(linhas[0]?.rotulo).toBe('INSS (5% do salário mínimo)');
    expect(
      detalhamentoDas(calcularDas(PARAMS_2026, 'comercio_servicos')).map((l) => l.codigo),
    ).toEqual(['inss', 'icms', 'iss']);
  });
});

describe('vencimentoDas (dia 20 do mês seguinte → próximo dia útil)', () => {
  it.each([
    ['2026-01', '2026-02-20'], // sexta
    ['2026-03', '2026-04-20'], // segunda
    ['2026-05', '2026-06-22'], // 20/06 sábado → segunda
    ['2026-08', '2026-09-21'], // 20/09 domingo → segunda
    ['2026-10', '2026-11-23'], // 20/11 feriado (sexta) → fim de semana → segunda
    ['2026-11', '2026-12-21'], // 20/12 domingo
    ['2026-12', '2027-01-20'], // vira o ano
    ['2025-03', '2025-04-22'], // 20/04 domingo de Páscoa → 21 Tiradentes → terça
    ['2025-10', '2025-11-21'], // 20/11 quinta feriado → sexta
  ])('%s vence em %s', (competencia, esperado) => {
    expect(vencimentoDas(competencia)).toBe(esperado);
  });

  it('aceita outro dia de vencimento', () => {
    expect(vencimentoDas('2026-01', 25)).toBe('2026-02-25');
  });
});

describe('competenciasDevidas', () => {
  it('sem data de abertura: de janeiro até o mês atual', () => {
    expect(competenciasDevidas({ ano: 2026, dataAbertura: null, hoje: '2026-03-15' })).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
    ]);
  });

  it('ano de abertura: do mês de abertura até o mês atual', () => {
    expect(
      competenciasDevidas({ ano: 2026, dataAbertura: '2026-03-10', hoje: '2026-09-09' }),
    ).toEqual(['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
  });

  it('ano passado: ano inteiro a partir da abertura', () => {
    expect(
      competenciasDevidas({ ano: 2025, dataAbertura: '2025-11-01', hoje: '2026-09-09' }),
    ).toEqual(['2025-11', '2025-12']);
    expect(
      competenciasDevidas({ ano: 2025, dataAbertura: '2020-01-01', hoje: '2026-09-09' }),
    ).toHaveLength(12);
  });

  it('casos vazios: ano futuro, abertura depois do ano, abertura depois de hoje', () => {
    expect(competenciasDevidas({ ano: 2027, dataAbertura: null, hoje: '2026-09-09' })).toEqual([]);
    expect(
      competenciasDevidas({ ano: 2025, dataAbertura: '2026-01-01', hoje: '2026-09-09' }),
    ).toEqual([]);
    expect(
      competenciasDevidas({ ano: 2026, dataAbertura: '2026-11-01', hoje: '2026-09-09' }),
    ).toEqual([]);
  });

  it('mesInicial e competenciasDoAno', () => {
    expect(mesInicial(2026, null)).toBe(1);
    expect(mesInicial(2026, '2026-05-20')).toBe(5);
    expect(mesInicial(2026, '2025-05-20')).toBe(1);
    expect(mesInicial(2026, '2027-01-01')).toBeNull();
    expect(competenciasDoAno(2026)).toHaveLength(12);
    expect(competenciasDoAno(2026)[11]).toBe('2026-12');
  });
});

describe('statusDas', () => {
  const hoje = '2026-09-09';
  it.each([
    ['2026-08', true, 'pago'],
    ['2026-10', false, 'futuro'],
    ['2026-09', false, 'pendente'], // vence 20/10
    ['2026-08', false, 'pendente'], // vence 21/09
    ['2026-07', false, 'atrasado'], // venceu 20/08
  ] as const)('%s pago=%s → %s', (competencia, pago, esperado) => {
    expect(statusDas({ competencia, pago, hoje })).toBe(esperado);
  });

  it('respeita vencimento informado e conta dias de atraso', () => {
    expect(statusDas({ competencia: '2026-08', pago: false, hoje, vencimento: '2026-09-08' })).toBe(
      'atrasado',
    );
    expect(statusDas({ competencia: '2026-08', pago: false, hoje, vencimento: '2026-09-09' })).toBe(
      'pendente',
    );
    expect(diasAtrasoDas('2026-08-20', hoje)).toBe(20);
    expect(diasAtrasoDas('2026-09-21', hoje)).toBe(0);
  });
});

describe('selecionarParametros', () => {
  const lista = [PARAMS_2025, PARAMS_2026];
  it('ano exato', () => {
    expect(selecionarParametros(lista, 2026)).toEqual({
      parametros: PARAMS_2026,
      desatualizado: false,
    });
  });
  it('maior ano ≤ pedido, marcado como desatualizado', () => {
    expect(selecionarParametros(lista, 2028)).toEqual({
      parametros: PARAMS_2026,
      desatualizado: true,
    });
  });
  it('null sem ano anterior', () => {
    expect(selecionarParametros(lista, 2024)).toBeNull();
    expect(selecionarParametros([], 2026)).toBeNull();
  });
});
