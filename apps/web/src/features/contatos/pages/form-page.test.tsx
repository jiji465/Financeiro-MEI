import type { ContatoDto } from '@meifin/shared';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mockFetch, respostaErro } from '@/test/fetch-mock';
import { renderWithProviders } from '@/test/render';

import { EditarContatoPage, NovoContatoPage } from './form-page';

const CONTATO: ContatoDto = {
  id: '11111111-1111-4111-8111-111111111111',
  tipo: 'cliente',
  nome: 'Maria da Silva',
  documento: '52998224725',
  tipoDocumento: 'cpf',
  email: 'maria@exemplo.com.br',
  telefone: '11987654321',
  endereco: {
    logradouro: 'Rua das Flores',
    numero: '10',
    complemento: null,
    bairro: 'Centro',
    cidade: 'São Paulo',
    uf: 'SP',
    cep: '01310100',
  },
  observacoes: null,
  ativo: true,
  createdAt: '2026-01-01T12:00:00.000Z',
  updatedAt: '2026-01-01T12:00:00.000Z',
};

function renderNovo() {
  return renderWithProviders(<NovoContatoPage />, {
    route: '/contatos/novo',
    routes: [
      { path: '/contatos', element: <p>Lista de contatos</p> },
      { path: '/contatos/novo', element: <NovoContatoPage /> },
      { path: '/contatos/:id', element: <p>Ficha do contato</p> },
    ],
  });
}

describe('NovoContatoPage', () => {
  it('mostra as mensagens de validação em pt-BR sem chamar a API', async () => {
    const fetchMock = mockFetch();
    const { user } = renderNovo();

    await user.click(screen.getByRole('button', { name: 'Cadastrar contato' }));

    expect(await screen.findByText('Informe o nome')).toBeInTheDocument();
    expect(screen.getByText('Escolha o tipo de contato')).toBeInTheDocument();
    expect(fetchMock.calls).toHaveLength(0);
  });

  it('valida CPF/CNPJ, e-mail e telefone', async () => {
    const fetchMock = mockFetch();
    const { user } = renderNovo();

    await user.type(screen.getByLabelText(/^Nome ou razão social/), 'Maria');
    await user.click(screen.getByRole('radio', { name: /^Cliente Quem compra/ }));
    await user.type(screen.getByLabelText(/^CPF ou CNPJ/), '52998224726');
    await user.type(screen.getByLabelText(/^E-mail/), 'nao-e-email');
    await user.type(screen.getByLabelText(/^Telefone/), '119');
    await user.click(screen.getByRole('button', { name: 'Cadastrar contato' }));

    expect(await screen.findByText('CPF ou CNPJ inválido')).toBeInTheDocument();
    expect(screen.getByText('E-mail inválido')).toBeInTheDocument();
    expect(screen.getByText('Telefone deve ter DDD + 8 ou 9 dígitos')).toBeInTheDocument();
    expect(fetchMock.calls).toHaveLength(0);

    // Documento válido com máscara é aceito
    await user.clear(screen.getByLabelText(/^CPF ou CNPJ/));
    await user.type(screen.getByLabelText(/^CPF ou CNPJ/), '529.982.247-25');
    await user.click(screen.getByRole('button', { name: 'Cadastrar contato' }));
    await waitFor(() => expect(screen.queryByText('CPF ou CNPJ inválido')).not.toBeInTheDocument());
  });

  it('envia o cadastro e navega para a ficha', async () => {
    const fetchMock = mockFetch([
      { method: 'POST', path: '/api/v1/contatos', status: 201, body: { data: CONTATO } },
    ]);
    const { user } = renderNovo();

    await user.click(screen.getByRole('radio', { name: /^Fornecedor/ }));
    await user.type(screen.getByLabelText(/^Nome ou razão social/), 'Papelaria Central');
    await user.type(screen.getByLabelText(/^CPF ou CNPJ/), '11.222.333/0001-81');
    await user.type(screen.getByLabelText(/^Telefone/), '11987654321');
    await user.type(screen.getByLabelText(/^E-mail/), 'contato@papelaria.com.br');
    await user.type(screen.getByLabelText('Cidade'), 'Campinas');
    await user.type(screen.getByLabelText(/^Anotações/), 'Entrega às terças');
    await user.click(screen.getByRole('button', { name: 'Cadastrar contato' }));

    expect(await screen.findByText('Ficha do contato')).toBeInTheDocument();
    expect(fetchMock.chamadas('/api/v1/contatos', 'POST')[0]?.body).toEqual({
      tipo: 'fornecedor',
      nome: 'Papelaria Central',
      documento: '11222333000181',
      email: 'contato@papelaria.com.br',
      telefone: '11987654321',
      endereco: { cidade: 'Campinas' },
      observacoes: 'Entrega às terças',
    });
  });

  it('mapeia o 409 de documento duplicado para o campo', async () => {
    mockFetch([
      {
        method: 'POST',
        path: '/api/v1/contatos',
        ...respostaErro(409, 'CONFLICT', 'Já existe um contato com esse documento', [
          { campo: 'documento', mensagem: 'Já cadastrado para "Maria da Silva"' },
        ]),
      },
    ]);
    const { user } = renderNovo();

    await user.click(screen.getByRole('radio', { name: /^Cliente Quem compra/ }));
    await user.type(screen.getByLabelText(/^Nome ou razão social/), 'Outra Maria');
    await user.type(screen.getByLabelText(/^CPF ou CNPJ/), '52998224725');
    await user.click(screen.getByRole('button', { name: 'Cadastrar contato' }));

    expect(await screen.findByText('Já cadastrado para "Maria da Silva"')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText(/^CPF ou CNPJ/)).toHaveAttribute('aria-invalid', 'true'),
    );
  });
});

describe('EditarContatoPage', () => {
  it('carrega o contato, mostra os valores e envia o PATCH', async () => {
    const fetchMock = mockFetch([
      { method: 'GET', path: `/api/v1/contatos/${CONTATO.id}`, body: { data: CONTATO } },
      {
        method: 'PATCH',
        path: `/api/v1/contatos/${CONTATO.id}`,
        body: { data: { ...CONTATO, nome: 'Maria Editada' } },
      },
    ]);
    const { user } = renderWithProviders(<EditarContatoPage />, {
      route: `/contatos/${CONTATO.id}/editar`,
      routes: [
        { path: '/contatos/:id/editar', element: <EditarContatoPage /> },
        { path: '/contatos/:id', element: <p>Ficha do contato</p> },
      ],
    });

    const nome = await screen.findByLabelText(/^Nome ou razão social/);
    expect(nome).toHaveValue('Maria da Silva');
    expect(screen.getByLabelText(/^CPF ou CNPJ/)).toHaveValue('529.982.247-25');
    expect(screen.getByLabelText(/^CEP/)).toHaveValue('01310-100');
    expect(screen.getByRole('radio', { name: /^Cliente Quem compra/ })).toBeChecked();

    await user.clear(nome);
    await user.type(nome, 'Maria Editada');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByText('Ficha do contato')).toBeInTheDocument();
    const patch = fetchMock.chamadas(`/api/v1/contatos/${CONTATO.id}`, 'PATCH')[0]?.body;
    expect(patch).toMatchObject({
      tipo: 'cliente',
      nome: 'Maria Editada',
      documento: '52998224725',
      endereco: {
        logradouro: 'Rua das Flores',
        numero: '10',
        bairro: 'Centro',
        cidade: 'São Paulo',
        uf: 'SP',
        cep: '01310100',
      },
    });
  });
});
