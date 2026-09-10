import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useAuthStore } from '@/features/auth/store';
import { criarLista, criarTenant, criarUser } from '@/test/factories';
import { mockFetch } from '@/test/fetch-mock';
import { renderWithProviders } from '@/test/render';

import { criarCategoria, criarConfiguracoes } from '../test/fixtures';
import { ConfiguracoesPage } from './configuracoes-page';

function mockRotasBase() {
  return mockFetch([
    { method: 'GET', path: '/api/v1/configuracoes', body: { data: criarConfiguracoes() } },
    { method: 'GET', path: '/api/v1/categorias', body: criarLista([criarCategoria()]) },
  ]);
}

describe('ConfiguracoesPage', () => {
  it('salva os dados do MEI com a nova atividade (comércio + serviços)', async () => {
    const fetchMock = mockRotasBase();
    fetchMock.rota({
      method: 'PATCH',
      path: '/api/v1/configuracoes',
      body: {
        data: criarConfiguracoes({
          mei: { ...criarConfiguracoes().mei, atividade: 'comercio_servicos' },
        }),
      },
    });

    const { user } = renderWithProviders(<ConfiguracoesPage />, { route: '/configuracoes' });

    expect(await screen.findByDisplayValue('Maria da Silva')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Comércio e serviços/i }));
    await user.click(screen.getByRole('button', { name: 'Salvar dados do MEI' }));

    await waitFor(() =>
      expect(fetchMock.chamadas('/api/v1/configuracoes', 'PATCH')).toHaveLength(1),
    );
    const corpo = fetchMock.chamadas('/api/v1/configuracoes', 'PATCH')[0]?.body as {
      mei: { atividade: string };
    };
    expect(corpo.mei.atividade).toBe('comercio_servicos');
  });

  it('cria uma categoria de despesa pela aba Categorias', async () => {
    const fetchMock = mockRotasBase();
    fetchMock.rota({
      method: 'POST',
      path: '/api/v1/categorias',
      status: 201,
      body: { data: criarCategoria({ nome: 'Aluguel', tipo: 'despesa', grupoDasn: null }) },
    });

    const { user } = renderWithProviders(<ConfiguracoesPage />, { route: '/configuracoes' });

    await user.click(await screen.findByRole('tab', { name: 'Categorias' }));
    await user.click(await screen.findByRole('button', { name: 'Nova categoria' }));
    const dialogo = await screen.findByRole('dialog');
    await user.type(within(dialogo).getByLabelText('Nome'), 'Aluguel');
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(fetchMock.chamadas('/api/v1/categorias', 'POST')).toHaveLength(1));
    expect(fetchMock.chamadas('/api/v1/categorias', 'POST')[0]?.body).toMatchObject({
      nome: 'Aluguel',
      tipo: 'despesa',
    });
  });

  it('não permite excluir a categoria de sistema "Impostos e DAS"', async () => {
    mockFetch([
      { method: 'GET', path: '/api/v1/configuracoes', body: { data: criarConfiguracoes() } },
      {
        method: 'GET',
        path: '/api/v1/categorias',
        body: criarLista([
          criarCategoria({
            nome: 'Impostos e DAS',
            tipo: 'despesa',
            sistema: true,
            grupoDasn: null,
          }),
        ]),
      },
    ]);

    const { user } = renderWithProviders(<ConfiguracoesPage />, { route: '/configuracoes' });
    await user.click(await screen.findByRole('tab', { name: 'Categorias' }));

    expect(await screen.findByText('Impostos e DAS')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /não pode ser excluída/ })).toBeDisabled();
  });

  it('altera a senha e mostra a confirmação', async () => {
    const fetchMock = mockRotasBase();
    fetchMock.rota({
      method: 'PATCH',
      path: '/api/v1/auth/me/senha',
      body: { accessToken: 'novo-token' },
    });
    // useChangePassword refaz /auth/me para zerar deveTrocarSenha no store.
    fetchMock.rota({
      method: 'GET',
      path: '/api/v1/auth/me',
      body: { data: { user: criarUser(), tenant: criarTenant() } },
    });

    const { user } = renderWithProviders(<ConfiguracoesPage />, { route: '/configuracoes' });
    await user.click(await screen.findByRole('tab', { name: 'Conta' }));

    await user.type(screen.getByLabelText('Senha atual'), 'senhaAntiga1');
    await user.type(screen.getByLabelText('Nova senha'), 'senhaNova123');
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'senhaNova123');
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));

    await waitFor(() =>
      expect(fetchMock.chamadas('/api/v1/auth/me/senha', 'PATCH')).toHaveLength(1),
    );
    expect(fetchMock.chamadas('/api/v1/auth/me/senha', 'PATCH')[0]?.body).toEqual({
      senhaAtual: 'senhaAntiga1',
      novaSenha: 'senhaNova123',
    });
    // form.reset() no onSuccess limpa os campos.
    await waitFor(() => expect(screen.getByLabelText('Senha atual')).toHaveValue(''));
  });

  it('sai da conta a partir da aba Conta', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'token-de-teste',
      user: criarUser(),
      tenant: criarTenant(),
    });
    const fetchMock = mockRotasBase();
    fetchMock.rota({ method: 'POST', path: '/api/v1/auth/logout', status: 204 });

    const { user } = renderWithProviders(<ConfiguracoesPage />, {
      route: '/configuracoes',
      routes: [
        { path: '/configuracoes', element: <ConfiguracoesPage /> },
        { path: '/entrar', element: <p>Página de login</p> },
      ],
    });
    await user.click(await screen.findByRole('tab', { name: 'Conta' }));
    await user.click(screen.getByRole('button', { name: 'Sair' }));
    const confirmacao = await screen.findByRole('alertdialog');
    await user.click(within(confirmacao).getByRole('button', { name: 'Sair' }));

    expect(await screen.findByText('Página de login')).toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
