import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useAuthStore } from '@/features/auth/store';
import { criarTenant, criarUser } from '@/test/factories';
import { mockFetch } from '@/test/fetch-mock';
import { renderWithProviders } from '@/test/render';

import { InicioPlaceholder } from './inicio-placeholder';

describe('InicioPlaceholder', () => {
  it('dá boas-vindas pelo primeiro nome e mostra o estado da API', async () => {
    useAuthStore.getState().setSession({
      accessToken: 't',
      user: criarUser({ nome: 'Maria da Silva' }),
      tenant: criarTenant(),
    });
    mockFetch([
      {
        method: 'GET',
        path: '/api/v1/health',
        body: { status: 'ok', db: 'pglite', versao: '0.1.0' },
      },
    ]);

    renderWithProviders(<InicioPlaceholder />);

    expect(screen.getByRole('heading', { name: 'Bem-vindo(a), Maria' })).toBeInTheDocument();
    expect(await screen.findByText('pglite')).toBeInTheDocument();
    expect(screen.getByText(/versão 0\.1\.0/)).toBeInTheDocument();
  });

  it('mostra erro quando a API não responde', async () => {
    mockFetch([{ method: 'GET', path: '/api/v1/health', falhaRede: true }]);
    renderWithProviders(<InicioPlaceholder />);
    expect(await screen.findByRole('alert')).toHaveTextContent('API indisponível');
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });
});
