import type { ProdutoServicoDto } from '@meifin/shared';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mockFetch } from '@/test/fetch-mock';
import { renderWithProviders } from '@/test/render';

import { ProdutosServicosListaPage } from './lista-page';

function criarItem(sobrescrever: Partial<ProdutoServicoDto> = {}): ProdutoServicoDto {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    tipo: 'produto',
    nome: 'Bolo de cenoura',
    descricao: 'Bolo caseiro de 1,2 kg',
    precoPadrao: 4_500,
    unidade: 'un',
    ativo: true,
    lancamentos: 3,
    createdAt: '2026-01-10T12:00:00.000Z',
    updatedAt: '2026-01-10T12:00:00.000Z',
    ...sobrescrever,
  };
}

describe('ProdutosServicosListaPage', () => {
  it('lista o catálogo com preço padrão e "A combinar" quando não há preço', async () => {
    mockFetch([
      {
        path: '/api/v1/produtos-servicos',
        body: {
          data: [
            criarItem(),
            criarItem({
              id: '22222222-2222-4222-8222-222222222222',
              tipo: 'servico',
              nome: 'Pacote mensal de design',
              descricao: null,
              precoPadrao: null,
              unidade: 'mês',
              lancamentos: 0,
            }),
          ],
        },
      },
    ]);

    renderWithProviders(<ProdutosServicosListaPage />, { route: '/produtos-servicos' });

    // A tabela (desktop) e o cartão (mobile) são renderizados juntos e escondidos por CSS.
    await waitFor(() => expect(screen.getAllByText('Bolo de cenoura').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Pacote mensal de design').length).toBeGreaterThan(0);
    expect(screen.getAllByText('R$ 45,00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('A combinar').length).toBeGreaterThan(0);
  });

  it('sem catálogo, convida a cadastrar o primeiro produto ou serviço', async () => {
    mockFetch([{ path: '/api/v1/produtos-servicos', body: { data: [] } }]);

    renderWithProviders(<ProdutosServicosListaPage />, { route: '/produtos-servicos' });

    await waitFor(() => expect(screen.getByText('Catálogo vazio')).toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: 'Novo produto' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Novo serviço' }).length).toBeGreaterThan(0);
  });

  it('?novo=servico (atalho [+] do topo) já abre o diálogo em "Novo serviço"', async () => {
    mockFetch([{ path: '/api/v1/produtos-servicos', body: { data: [] } }]);

    renderWithProviders(<ProdutosServicosListaPage />, {
      route: '/produtos-servicos?novo=servico',
    });

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Novo serviço' })).toBeInTheDocument(),
    );
  });
});
