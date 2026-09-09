import { describe, expect, it } from 'vitest';

import {
  agruparPorPeriodo,
  gerarPeriodos,
  inicioSemana,
  type ItemFluxo,
  rotuloPeriodo,
  rotuloSemanaIso,
  saldoProjetado,
  saldoRealizado,
} from './fluxo-caixa.js';

describe('rótulos de período', () => {
  it.each([
    ['2026-01-01', '2026-W01'],
    ['2027-01-01', '2026-W53'],
    ['2024-12-30', '2025-W01'],
    ['2026-09-09', '2026-W37'],
    ['2026-09-13', '2026-W37'], // domingo ainda é a mesma semana ISO
  ])('rotuloSemanaIso(%s) = %s', (data, esperado) => {
    expect(rotuloSemanaIso(data)).toBe(esperado);
  });

  it('inicioSemana é segunda-feira', () => {
    expect(inicioSemana('2026-09-07')).toBe('2026-09-07');
    expect(inicioSemana('2026-09-09')).toBe('2026-09-07');
    expect(inicioSemana('2026-09-13')).toBe('2026-09-07');
  });

  it('rotuloPeriodo por agrupamento', () => {
    expect(rotuloPeriodo('2026-09-09', 'dia')).toBe('2026-09-09');
    expect(rotuloPeriodo('2026-09-09', 'semana')).toBe('2026-W37');
    expect(rotuloPeriodo('2026-09-09', 'mes')).toBe('2026-09');
  });
});

describe('gerarPeriodos', () => {
  it('mês: recorta o primeiro e o último', () => {
    expect(gerarPeriodos('2026-01-30', '2026-03-02', 'mes')).toEqual([
      { periodo: '2026-01', inicio: '2026-01-30', fim: '2026-01-31' },
      { periodo: '2026-02', inicio: '2026-02-01', fim: '2026-02-28' },
      { periodo: '2026-03', inicio: '2026-03-01', fim: '2026-03-02' },
    ]);
  });

  it('semana: começa na data pedida e vai até domingo', () => {
    expect(gerarPeriodos('2026-09-09', '2026-09-22', 'semana')).toEqual([
      { periodo: '2026-W37', inicio: '2026-09-09', fim: '2026-09-13' },
      { periodo: '2026-W38', inicio: '2026-09-14', fim: '2026-09-20' },
      { periodo: '2026-W39', inicio: '2026-09-21', fim: '2026-09-22' },
    ]);
  });

  it('dia', () => {
    expect(gerarPeriodos('2026-09-09', '2026-09-11', 'dia').map((p) => p.periodo)).toEqual([
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
    ]);
  });

  it('período invertido → vazio', () => {
    expect(gerarPeriodos('2026-09-11', '2026-09-09', 'dia')).toEqual([]);
  });
});

describe('agruparPorPeriodo', () => {
  const itens: ItemFluxo[] = [
    { data: '2026-09-10', tipo: 'receita', valor: 1000, realizado: true },
    { data: '2026-09-16', tipo: 'despesa', valor: 300, realizado: true },
    { data: '2026-09-01', tipo: 'receita', valor: 500, realizado: false }, // vencida → cai em "hoje"
    { data: '2026-09-21', tipo: 'despesa', valor: 200, realizado: false },
    { data: '2026-09-01', tipo: 'receita', valor: 9999, realizado: true }, // fora do período: ignorada
    { data: '2026-10-05', tipo: 'receita', valor: 777, realizado: false }, // fora do período: ignorada
  ];
  const opcoes = {
    de: '2026-09-09',
    ate: '2026-09-22',
    agrupamento: 'semana' as const,
    saldoInicial: 100,
    hoje: '2026-09-10',
  };

  it('realizado, previsto e vencidos no período atual', () => {
    const periodos = agruparPorPeriodo(itens, opcoes);
    expect(periodos).toEqual([
      {
        periodo: '2026-W37',
        inicio: '2026-09-09',
        fim: '2026-09-13',
        receitas: 1000,
        despesas: 0,
        receitasPrevistas: 500,
        despesasPrevistas: 0,
        saldoPeriodo: 1000,
        saldoAcumulado: 1100,
        saldoProjetado: 1600,
      },
      {
        periodo: '2026-W38',
        inicio: '2026-09-14',
        fim: '2026-09-20',
        receitas: 0,
        despesas: 300,
        receitasPrevistas: 0,
        despesasPrevistas: 0,
        saldoPeriodo: -300,
        saldoAcumulado: 800,
        saldoProjetado: 1300,
      },
      {
        periodo: '2026-W39',
        inicio: '2026-09-21',
        fim: '2026-09-22',
        receitas: 0,
        despesas: 0,
        receitasPrevistas: 0,
        despesasPrevistas: 200,
        saldoPeriodo: 0,
        saldoAcumulado: 800,
        saldoProjetado: 1100,
      },
    ]);
  });

  it('incluirPrevisao=false ignora previstos', () => {
    const periodos = agruparPorPeriodo(itens, { ...opcoes, incluirPrevisao: false });
    expect(periodos.map((p) => p.receitasPrevistas + p.despesasPrevistas)).toEqual([0, 0, 0]);
    expect(periodos[2]?.saldoProjetado).toBe(800);
  });

  it('vencidos com hoje fora do período são ignorados', () => {
    const periodos = agruparPorPeriodo(itens, { ...opcoes, hoje: '2026-10-01' });
    expect(periodos[0]?.receitasPrevistas).toBe(0);
  });

  it('agrupamento por mês e por dia', () => {
    const mes = agruparPorPeriodo(itens, { ...opcoes, agrupamento: 'mes' });
    expect(mes).toHaveLength(1);
    expect(mes[0]).toMatchObject({
      periodo: '2026-09',
      receitas: 1000,
      despesas: 300,
      saldoProjetado: 1100,
    });
    const dia = agruparPorPeriodo(itens, { ...opcoes, agrupamento: 'dia' });
    expect(dia).toHaveLength(14);
    expect(dia[1]).toMatchObject({ periodo: '2026-09-10', receitas: 1000, receitasPrevistas: 500 });
  });
});

describe('saldos', () => {
  const itens: ItemFluxo[] = [
    { data: '2026-09-10', tipo: 'receita', valor: 1000, realizado: true },
    { data: '2026-09-11', tipo: 'despesa', valor: 300, realizado: true },
    { data: '2026-09-12', tipo: 'receita', valor: 500, realizado: false },
    { data: '2026-09-13', tipo: 'despesa', valor: 50, realizado: false },
  ];
  it('saldoRealizado só conta pagos', () => {
    expect(saldoRealizado(100, itens)).toBe(800);
  });
  it('saldoProjetado conta tudo', () => {
    expect(saldoProjetado(100, itens)).toBe(1250);
  });
});
