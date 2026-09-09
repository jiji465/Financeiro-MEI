import { describe, expect, it } from 'vitest';

import { type LinhaDre, montarDre } from './dre.js';

const linha = (parcial: Partial<LinhaDre> & Pick<LinhaDre, 'tipo' | 'valor'>): LinhaDre => ({
  categoriaId: 'c1',
  categoriaNome: 'Categoria',
  grupoDasn: null,
  categoriaSistema: false,
  ...parcial,
});

describe('montarDre', () => {
  it('agrupa por categoria, ordena por valor, destaca impostos e calcula margem', () => {
    const dre = montarDre([
      linha({
        tipo: 'receita',
        valor: 6000,
        categoriaId: 'r1',
        categoriaNome: 'Serviços',
        grupoDasn: 'servicos',
      }),
      linha({
        tipo: 'receita',
        valor: 4000,
        categoriaId: 'r1',
        categoriaNome: 'Serviços',
        grupoDasn: 'servicos',
      }),
      linha({
        tipo: 'receita',
        valor: 2000,
        categoriaId: 'r2',
        categoriaNome: 'Vendas',
        grupoDasn: 'comercio',
      }),
      linha({
        tipo: 'despesa',
        valor: 800,
        categoriaId: 'd1',
        categoriaNome: 'Impostos e DAS',
        categoriaSistema: true,
      }),
      linha({ tipo: 'despesa', valor: 1200, categoriaId: 'd2', categoriaNome: 'Aluguel' }),
      linha({ tipo: 'despesa', valor: 1000, categoriaId: 'd3', categoriaNome: 'Internet' }),
    ]);

    expect(dre.receitas.total).toBe(12_000);
    expect(dre.receitas.itens).toEqual([
      {
        categoriaId: 'r1',
        nome: 'Serviços',
        grupoDasn: 'servicos',
        valor: 10_000,
        percentual: 83.33,
        quantidade: 2,
      },
      {
        categoriaId: 'r2',
        nome: 'Vendas',
        grupoDasn: 'comercio',
        valor: 2000,
        percentual: 16.67,
        quantidade: 1,
      },
    ]);
    expect(dre.despesas.total).toBe(3000);
    expect(dre.despesas.itens.map((i) => i.nome)).toEqual([
      'Aluguel',
      'Internet',
      'Impostos e DAS',
    ]);
    expect(dre.impostos).toBe(800);
    expect(dre.resultado).toBe(9000);
    expect(dre.margem).toBe(75);
  });

  it('sem receitas: margem null e resultado negativo', () => {
    const dre = montarDre([linha({ tipo: 'despesa', valor: 500 })]);
    expect(dre.receitas).toEqual({ total: 0, itens: [] });
    expect(dre.resultado).toBe(-500);
    expect(dre.margem).toBeNull();
    expect(dre.despesas.itens[0]?.percentual).toBe(100);
  });

  it('lista vazia', () => {
    expect(montarDre([])).toEqual({
      receitas: { total: 0, itens: [] },
      despesas: { total: 0, itens: [] },
      impostos: 0,
      resultado: 0,
      margem: null,
    });
  });

  it('empate de valor ordena por nome; categoria nula vira "Sem categoria"', () => {
    const dre = montarDre([
      linha({ tipo: 'despesa', valor: 100, categoriaId: 'b', categoriaNome: 'Zebra' }),
      linha({ tipo: 'despesa', valor: 100, categoriaId: 'a', categoriaNome: 'Água' }),
      linha({ tipo: 'despesa', valor: 100, categoriaId: null, categoriaNome: '' }),
    ]);
    expect(dre.despesas.itens.map((i) => i.nome)).toEqual(['Água', 'Sem categoria', 'Zebra']);
    expect(dre.despesas.itens[1]?.categoriaId).toBeNull();
  });
});
