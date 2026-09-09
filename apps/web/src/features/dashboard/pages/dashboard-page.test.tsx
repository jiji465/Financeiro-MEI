import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mockFetch } from '@/test/fetch-mock';
import { renderWithProviders } from '@/test/render';

import { DashboardPage } from './dashboard-page';

const RESUMO = {
  periodo: { de: '2026-09-01', ate: '2026-09-30' },
  receitas: { valor: 500_000, anterior: 400_000, variacao: 25 },
  despesas: { valor: 100_000, anterior: 50_000, variacao: 100 },
  saldo: { valor: 400_000, anterior: 350_000, variacao: 14.29 },
  receitasPendentes: 150_000,
  despesasPendentes: 0,
  saldoPrevisto: 550_000,
  quantidadeLancamentos: 4,
  limite: { ano: 2026, limite: 8_100_000, acumulado: 3_000_000, percentual: 37.04, nivel: 'ok' },
  proximosVencimentos: [
    {
      data: '2026-09-21',
      tipo: 'das' as const,
      titulo: 'DAS set/2026',
      valor: 8605,
      atrasado: false,
      referenciaId: null,
      competencia: '2026-09',
    },
  ],
};

const COMPARATIVO = {
  meses: [
    {
      competencia: '2026-09',
      receitas: 500_000,
      despesas: 100_000,
      saldo: 400_000,
      receitasPendentes: 0,
      despesasPendentes: 0,
    },
  ],
  medias: { receitas: 500_000, despesas: 100_000, saldo: 400_000 },
  totais: { receitas: 500_000, despesas: 100_000, saldo: 400_000 },
};

const POR_CATEGORIA = {
  periodo: { de: '2026-09-01', ate: '2026-09-30' },
  tipo: 'despesa' as const,
  // Valor diferente do total de despesas do resumo de propósito, para não colidir na busca por texto.
  total: 90_000,
  itens: [
    {
      categoriaId: 'cat-1',
      nome: 'Aluguel',
      cor: '#0f766e',
      icone: null,
      valor: 90_000,
      percentual: 100,
      quantidade: 1,
    },
  ],
};

const LIMITE_COMPLETO = {
  ano: 2026,
  anoAbertura: false,
  mesInicio: 1,
  mesesConsiderados: 12,
  limite: 8_100_000,
  tolerancia: 9_720_000,
  acumulado: 3_000_000,
  restante: 5_100_000,
  percentual: 37.04,
  nivel: 'ok',
  excesso: null,
  valorExcedido: 0,
  diasDecorridos: 252,
  diasTotais: 365,
  mediaMensal: 333_333,
  projecao: 4_000_000,
  projecaoPercentual: 49.38,
  projecaoExcede: false,
  consequencia: null,
  regime: 'competencia',
  porMes: [],
  marcas: [70, 85, 100],
};

function mockDashboardApis() {
  return mockFetch([
    { method: 'GET', path: '/api/v1/dashboard/resumo', body: { data: RESUMO } },
    { method: 'GET', path: '/api/v1/dashboard/comparativo-mensal', body: { data: COMPARATIVO } },
    { method: 'GET', path: '/api/v1/dashboard/por-categoria', body: { data: POR_CATEGORIA } },
    { method: 'GET', path: '/api/v1/configuracoes', body: { data: { mostrarProjecao: true } } },
    { method: 'GET', path: '/api/v1/obrigacoes/limite', body: { data: LIMITE_COMPLETO } },
    { method: 'GET', path: '/api/v1/obrigacoes/alertas', body: { data: [] } },
  ]);
}

describe('DashboardPage', () => {
  it('mostra os cards de resumo com receitas, despesas e saldo do período', async () => {
    mockDashboardApis();
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('Visão geral')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('R$ 5.000,00')).toBeInTheDocument());
    expect(screen.getByText('R$ 1.000,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 4.000,00')).toBeInTheDocument();
  });

  it('lista o próximo vencimento (DAS) com o link para /das', async () => {
    mockDashboardApis();
    renderWithProviders(<DashboardPage />);

    const link = await screen.findByRole('link', { name: /DAS set\/2026/ });
    expect(link).toHaveAttribute('href', '/das');
  });

  it('mostra os atalhos de ação rápida', async () => {
    mockDashboardApis();
    renderWithProviders(<DashboardPage />);

    const nav = screen.getByRole('navigation', { name: 'Atalhos' });
    expect(within(nav).getByRole('link', { name: 'Nova receita' })).toHaveAttribute(
      'href',
      '/lancamentos?novo=receita',
    );
    expect(within(nav).getByRole('link', { name: 'Nova despesa' })).toHaveAttribute(
      'href',
      '/lancamentos?novo=despesa',
    );
  });
});
