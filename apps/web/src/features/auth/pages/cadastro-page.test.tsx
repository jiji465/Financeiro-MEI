import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useAuthStore } from '@/features/auth/store';
import { criarAuthResponse } from '@/test/factories';
import { mockFetch, respostaErro } from '@/test/fetch-mock';
import { renderWithProviders } from '@/test/render';

import { CadastroPage, forcaDaSenha } from './cadastro-page';

function renderCadastro() {
  return renderWithProviders(<CadastroPage />, {
    route: '/cadastro',
    routes: [
      { path: '/cadastro', element: <CadastroPage /> },
      { path: '/', element: <p>Início do app</p> },
    ],
  });
}

describe('CadastroPage', () => {
  it('mostra as mensagens de validação em pt-BR', async () => {
    const fetchMock = mockFetch();
    const { user } = renderCadastro();

    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText('Informe seu nome')).toBeInTheDocument();
    expect(screen.getByText('E-mail inválido')).toBeInTheDocument();
    expect(screen.getByText('A senha deve ter pelo menos 8 caracteres')).toBeInTheDocument();
    expect(screen.getByText('Escolha a atividade do seu MEI')).toBeInTheDocument();
    expect(fetchMock.calls).toHaveLength(0);
  });

  it('valida confirmação de senha e CNPJ', async () => {
    mockFetch();
    const { user } = renderCadastro();

    // A comparação de senhas é uma regra do objeto; o zod 4 só a executa quando os campos
    // individuais estão válidos, então preenchemos o restante do formulário.
    await user.type(screen.getByLabelText('Seu nome'), 'Maria');
    await user.type(screen.getByLabelText('E-mail'), 'maria@exemplo.com.br');
    await user.click(screen.getByRole('radio', { name: /Prestação de serviços/ }));
    await user.type(screen.getByLabelText('Senha'), 'segredo123');
    await user.type(screen.getByLabelText('Confirmar senha'), 'segredo124');
    await user.type(screen.getByLabelText(/^CNPJ/), '11222333000180');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText('CNPJ inválido')).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/^CNPJ/));
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText('As senhas não conferem')).toBeInTheDocument();
    expect(screen.queryByText('CNPJ inválido')).not.toBeInTheDocument();
  });

  it('pede os tributos quando a atividade é caminhoneiro', async () => {
    mockFetch();
    const { user } = renderCadastro();

    expect(screen.queryByText('Tributos do MEI Caminhoneiro')).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /MEI Caminhoneiro/ }));
    expect(await screen.findByText('Tributos do MEI Caminhoneiro')).toBeInTheDocument();
  });

  it('envia o cadastro e entra no app', async () => {
    const resposta = criarAuthResponse({ accessToken: 'novo-token' });
    const fetchMock = mockFetch([
      { method: 'POST', path: '/api/v1/auth/signup', status: 201, body: resposta },
    ]);
    const { user } = renderCadastro();

    await user.type(screen.getByLabelText('Seu nome'), 'Maria da Silva');
    await user.type(screen.getByLabelText('E-mail'), 'maria@exemplo.com.br');
    await user.type(screen.getByLabelText('Senha'), 'Segredo#123');
    await user.type(screen.getByLabelText('Confirmar senha'), 'Segredo#123');
    await user.type(screen.getByLabelText(/^CNPJ/), '11.222.333/0001-81');
    await user.click(screen.getByRole('radio', { name: /Prestação de serviços/ }));
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText('Início do app')).toBeInTheDocument();
    expect(fetchMock.chamadas('/api/v1/auth/signup', 'POST')[0]?.body).toEqual({
      nome: 'Maria da Silva',
      email: 'maria@exemplo.com.br',
      senha: 'Segredo#123',
      cnpj: '11222333000181',
      atividade: 'servicos',
    });
    expect(useAuthStore.getState().accessToken).toBe('novo-token');
  });

  it('mapeia erro de campo vindo do servidor (e-mail já cadastrado)', async () => {
    mockFetch([
      {
        method: 'POST',
        path: '/api/v1/auth/signup',
        ...respostaErro(409, 'CONFLICT', 'Conflito', [
          { campo: 'email', mensagem: 'E-mail já cadastrado' },
        ]),
      },
    ]);
    const { user } = renderCadastro();

    await user.type(screen.getByLabelText('Seu nome'), 'Maria');
    await user.type(screen.getByLabelText('E-mail'), 'maria@exemplo.com.br');
    await user.type(screen.getByLabelText('Senha'), 'Segredo#123');
    await user.type(screen.getByLabelText('Confirmar senha'), 'Segredo#123');
    await user.click(screen.getByRole('radio', { name: /Comércio ou indústria/ }));
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText('E-mail já cadastrado')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true'),
    );
  });
});

describe('forcaDaSenha', () => {
  it('classifica a senha', () => {
    expect(forcaDaSenha('')).toEqual({ nivel: 0, rotulo: '' });
    expect(forcaDaSenha('abc').rotulo).toBe('Fraca');
    expect(forcaDaSenha('abcdefgh1').rotulo).toBe('Razoável');
    expect(forcaDaSenha('Abcdefgh1').rotulo).toBe('Boa');
    expect(forcaDaSenha('Abcdefgh#1234').rotulo).toBe('Forte');
  });
});
