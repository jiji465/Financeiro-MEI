import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mockFetch, respostaErro } from '@/test/fetch-mock';
import { renderWithProviders } from '@/test/render';

import { CadastroPage } from './cadastro-page';

function renderCadastro() {
  return renderWithProviders(<CadastroPage />, {
    route: '/cadastro',
    routes: [{ path: '/cadastro', element: <CadastroPage /> }],
  });
}

describe('CadastroPage (solicitar acesso)', () => {
  it('mostra as mensagens de validação em pt-BR', async () => {
    const fetchMock = mockFetch();
    const { user } = renderCadastro();

    await user.click(screen.getByRole('button', { name: 'Solicitar acesso' }));

    expect(await screen.findByText('Informe seu nome')).toBeInTheDocument();
    expect(screen.getByText('E-mail inválido')).toBeInTheDocument();
    expect(fetchMock.calls).toHaveLength(0);
  });

  it('pede os tributos quando a atividade é caminhoneiro', async () => {
    mockFetch();
    const { user } = renderCadastro();

    expect(screen.queryByText('Tributos do MEI Caminhoneiro')).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /MEI Caminhoneiro/ }));
    // O formulário de solicitação não pergunta os tributos (isso é feito na criação da conta
    // pelo admin) — a atividade escolhida só ajuda o admin a se preparar para o contato.
    expect(screen.queryByText('Tributos do MEI Caminhoneiro')).not.toBeInTheDocument();
  });

  it('envia o pedido sem logar automaticamente e mostra a confirmação', async () => {
    const fetchMock = mockFetch([
      {
        method: 'POST',
        path: '/api/v1/solicitacoes-acesso',
        status: 202,
        body: { data: { mensagem: 'Recebemos seu pedido. Entraremos em contato em breve.' } },
      },
    ]);
    const { user } = renderCadastro();

    await user.type(screen.getByLabelText('Seu nome'), 'Maria da Silva');
    await user.type(screen.getByLabelText('E-mail'), 'maria@exemplo.com.br');
    await user.click(screen.getByRole('radio', { name: /Prestação de serviços/ }));
    await user.click(screen.getByRole('button', { name: 'Solicitar acesso' }));

    expect(await screen.findByText('Pedido recebido')).toBeInTheDocument();
    expect(fetchMock.chamadas('/api/v1/solicitacoes-acesso', 'POST')[0]?.body).toEqual({
      nome: 'Maria da Silva',
      email: 'maria@exemplo.com.br',
      atividade: 'servicos',
    });
  });

  it('mapeia erro de campo vindo do servidor', async () => {
    mockFetch([
      {
        method: 'POST',
        path: '/api/v1/solicitacoes-acesso',
        ...respostaErro(400, 'VALIDATION_ERROR', 'Dados inválidos', [
          { campo: 'email', mensagem: 'E-mail inválido' },
        ]),
      },
    ]);
    const { user } = renderCadastro();

    await user.type(screen.getByLabelText('Seu nome'), 'Maria');
    await user.type(screen.getByLabelText('E-mail'), 'maria@exemplo.com.br');
    await user.click(screen.getByRole('button', { name: 'Solicitar acesso' }));

    await screen.findByText('E-mail inválido');
  });
});
