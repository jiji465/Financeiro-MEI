// Tour guiado: aparece sozinho quando preferencias.mostrarBoasVindas é true, some quando é false, e
// "Pular" fecha o tour gravando mostrarBoasVindas: false.
import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { criarConfiguracoes } from '@/features/configuracoes/test/fixtures';
import { mockFetch } from '@/test/fetch-mock';
import { renderWithProviders } from '@/test/render';

import { useTourStore } from '../store';
import { TourGuiado } from './tour-guiado';

// A store do tour é um singleton (zustand): sem isso, "aberto: true" de um teste vaza pro próximo.
afterEach(() => {
  useTourStore.setState({ aberto: false });
});

describe('TourGuiado', () => {
  it('aparece automaticamente quando mostrarBoasVindas é true', async () => {
    mockFetch([
      { method: 'GET', path: '/api/v1/configuracoes', body: { data: criarConfiguracoes() } },
    ]);

    renderWithProviders(<TourGuiado />);

    expect(await screen.findByText('Bem-vindo ao MEI Financeiro!')).toBeInTheDocument();
    expect(screen.getByText('1 de 8')).toBeInTheDocument();
  });

  it('não aparece quando mostrarBoasVindas já é false', async () => {
    const fetchMock = mockFetch([
      {
        method: 'GET',
        path: '/api/v1/configuracoes',
        body: {
          data: criarConfiguracoes({
            preferencias: {
              tema: 'sistema',
              ocultarValores: false,
              paginaInicial: '/',
              mostrarBoasVindas: false,
            },
          }),
        },
      },
    ]);

    renderWithProviders(<TourGuiado />);

    await waitFor(() => expect(fetchMock.chamadas('/api/v1/configuracoes')).toHaveLength(1));
    expect(screen.queryByText('Bem-vindo ao MEI Financeiro!')).not.toBeInTheDocument();
  });

  it('"Pular" fecha o tour e grava mostrarBoasVindas: false', async () => {
    const fetchMock = mockFetch([
      { method: 'GET', path: '/api/v1/configuracoes', body: { data: criarConfiguracoes() } },
    ]);
    fetchMock.rota({
      method: 'PATCH',
      path: '/api/v1/configuracoes',
      body: {
        data: criarConfiguracoes({
          preferencias: {
            tema: 'sistema',
            ocultarValores: false,
            paginaInicial: '/',
            mostrarBoasVindas: false,
          },
        }),
      },
    });

    const { user } = renderWithProviders(<TourGuiado />);

    await screen.findByText('Bem-vindo ao MEI Financeiro!');
    await user.click(screen.getByRole('button', { name: 'Pular' }));

    await waitFor(() =>
      expect(fetchMock.chamadas('/api/v1/configuracoes', 'PATCH')).toHaveLength(1),
    );
    expect(fetchMock.chamadas('/api/v1/configuracoes', 'PATCH')[0]?.body).toEqual({
      preferencias: { mostrarBoasVindas: false },
    });
    expect(screen.queryByText('Bem-vindo ao MEI Financeiro!')).not.toBeInTheDocument();
  });
});
