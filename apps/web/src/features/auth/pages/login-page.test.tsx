import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useAuthStore } from '@/features/auth/store';
import { criarAuthResponse } from '@/test/factories';
import { mockFetch, respostaErro } from '@/test/fetch-mock';
import { renderWithProviders } from '@/test/render';

import { LoginPage } from './login-page';

function renderLogin(route = '/entrar') {
  return renderWithProviders(<LoginPage />, {
    route,
    routes: [
      { path: '/entrar', element: <LoginPage /> },
      { path: '/', element: <p>Início do app</p> },
      { path: '/lancamentos', element: <p>Página de lançamentos</p> },
    ],
  });
}

describe('LoginPage', () => {
  it('valida os campos em pt-BR antes de enviar', async () => {
    const fetchMock = mockFetch();
    const { user } = renderLogin();

    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('E-mail inválido')).toBeInTheDocument();
    expect(screen.getByText('Informe a senha')).toBeInTheDocument();
    expect(fetchMock.calls).toHaveLength(0);
  });

  it('envia as credenciais, guarda o token e redireciona para ?next=', async () => {
    const resposta = criarAuthResponse({ accessToken: 'abc123' });
    const fetchMock = mockFetch([{ method: 'POST', path: '/api/v1/auth/login', body: resposta }]);
    const { user } = renderLogin('/entrar?next=%2Flancamentos');

    await user.type(screen.getByLabelText('E-mail'), 'Maria@Exemplo.com.br');
    await user.type(screen.getByLabelText('Senha'), 'segredo123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Página de lançamentos')).toBeInTheDocument();
    expect(fetchMock.chamadas('/api/v1/auth/login', 'POST')[0]?.body).toEqual({
      email: 'maria@exemplo.com.br',
      senha: 'segredo123',
    });
    const estado = useAuthStore.getState();
    expect(estado.accessToken).toBe('abc123');
    expect(estado.user?.email).toBe(resposta.user.email);
    expect(estado.tenant?.id).toBe(resposta.tenant.id);
  });

  it('mostra a mensagem do servidor em credenciais inválidas', async () => {
    mockFetch([
      {
        method: 'POST',
        path: '/api/v1/auth/login',
        ...respostaErro(401, 'UNAUTHORIZED', 'E-mail ou senha inválidos'),
      },
    ]);
    const { user } = renderLogin();

    await user.type(screen.getByLabelText('E-mail'), 'maria@exemplo.com.br');
    await user.type(screen.getByLabelText('Senha'), 'errada123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos');
    await waitFor(() => expect(useAuthStore.getState().accessToken).toBeNull());
  });

  it('mostra erro de rede de forma amigável', async () => {
    mockFetch([{ method: 'POST', path: '/api/v1/auth/login', falhaRede: true }]);
    const { user } = renderLogin();

    await user.type(screen.getByLabelText('E-mail'), 'maria@exemplo.com.br');
    await user.type(screen.getByLabelText('Senha'), 'segredo123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão com o servidor');
  });

  it('alterna a visibilidade da senha', async () => {
    mockFetch();
    const { user } = renderLogin();
    const senha = screen.getByLabelText('Senha');
    expect(senha).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(senha).toHaveAttribute('type', 'text');
  });
});
