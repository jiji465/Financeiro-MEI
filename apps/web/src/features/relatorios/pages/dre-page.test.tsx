import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mockFetch } from '@/test/fetch-mock';
import { renderWithProviders } from '@/test/render';

import { DrePage } from './dre-page';

const DRE = {
  receitas: {
    total: 500_000,
    itens: [
      {
        categoriaId: 'c1',
        nome: 'Prestação de serviços',
        grupoDasn: 'servicos',
        valor: 500_000,
        percentual: 100,
        quantidade: 3,
      },
    ],
  },
  despesas: {
    total: 100_000,
    itens: [
      {
        categoriaId: 'c2',
        nome: 'Aluguel',
        grupoDasn: null,
        valor: 100_000,
        percentual: 100,
        quantidade: 1,
      },
    ],
  },
  impostos: 8605,
  resultado: 391_395,
  margem: 78.28,
  periodo: { de: '2026-09-01', ate: '2026-09-30' },
  regime: 'competencia' as const,
  geradoEm: '2026-09-15T12:00:00.000Z',
};

describe('DrePage', () => {
  it('mostra receitas, despesas e o resultado do período', async () => {
    const fetchMock = mockFetch([
      { method: 'GET', path: '/api/v1/relatorios/dre', body: { data: DRE } },
    ]);
    renderWithProviders(<DrePage />, { route: '/relatorios/dre' });

    expect(await screen.findByText('Prestação de serviços')).toBeInTheDocument();
    expect(screen.getByText('Aluguel')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('R$ 3.913,95')).toBeInTheDocument());
    expect(fetchMock.calls.at(-1)?.url).toContain('formato=json');
  });

  it('tem os botões de exportação CSV e PDF', async () => {
    mockFetch([{ method: 'GET', path: '/api/v1/relatorios/dre', body: { data: DRE } }]);
    renderWithProviders(<DrePage />, { route: '/relatorios/dre' });

    await screen.findByText('Prestação de serviços');
    expect(screen.getByRole('button', { name: 'CSV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PDF' })).toBeInTheDocument();
  });
});
