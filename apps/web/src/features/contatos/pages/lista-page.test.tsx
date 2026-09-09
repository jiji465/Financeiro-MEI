import type { ContatoDto } from '@meifin/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { criarLista } from '@/test/factories';
import { mockFetch } from '@/test/fetch-mock';
import { renderWithProviders } from '@/test/render';

import { ContatosListaPage } from './lista-page';

function criarContato(sobrescrever: Partial<ContatoDto> = {}): ContatoDto {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    tipo: 'cliente',
    nome: 'Maria da Silva',
    documento: '52998224725',
    tipoDocumento: 'cpf',
    email: 'maria@exemplo.com.br',
    telefone: '11987654321',
    endereco: {
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      cidade: 'São Paulo',
      uf: 'SP',
      cep: null,
    },
    observacoes: null,
    ativo: true,
    createdAt: '2026-01-01T12:00:00.000Z',
    updatedAt: '2026-01-01T12:00:00.000Z',
    ...sobrescrever,
  };
}

const MARIA = criarContato();
const PAPELARIA = criarContato({
  id: '22222222-2222-4222-8222-222222222222',
  tipo: 'fornecedor',
  nome: 'Papelaria Central',
  documento: '11222333000181',
  tipoDocumento: 'cnpj',
  email: null,
  telefone: null,
});

function renderLista(route = '/contatos') {
  return renderWithProviders(<ContatosListaPage />, {
    route,
    routes: [
      { path: '/contatos', element: <ContatosListaPage /> },
      { path: '/contatos/novo', element: <p>Formulário de novo contato</p> },
      { path: '/contatos/:id', element: <p>Ficha do contato</p> },
    ],
  });
}

describe('ContatosListaPage', () => {
  it('lista os contatos com tipo, documento formatado e link para a ficha', async () => {
    mockFetch([{ method: 'GET', path: '/api/v1/contatos', body: criarLista([MARIA, PAPELARIA]) }]);
    renderLista();

    const link = await screen.findByRole('link', { name: 'Maria da Silva' });
    expect(link).toHaveAttribute('href', `/contatos/${MARIA.id}`);
    const tabela = screen.getByRole('table', { name: 'Clientes e fornecedores' });
    expect(within(tabela).getByText('529.982.247-25')).toBeInTheDocument();
    expect(within(tabela).getByText('11.222.333/0001-81')).toBeInTheDocument();
    expect(within(tabela).getAllByText('Cliente')).toHaveLength(1);
    expect(within(tabela).getAllByText('Fornecedor')).toHaveLength(1);
    expect(within(tabela).getByText('(11) 98765-4321')).toBeInTheDocument();
  });

  it('filtra por aba (?tipo) e por busca com debounce (?q)', async () => {
    const fetchMock = mockFetch([
      {
        method: 'GET',
        path: '/api/v1/contatos',
        handler: (chamada) => {
          const url = new URL(chamada.url, 'http://localhost');
          const tipo = url.searchParams.get('tipo');
          const busca = url.searchParams.get('busca')?.toLowerCase();
          let itens = [MARIA, PAPELARIA];
          if (tipo) itens = itens.filter((c) => c.tipo === tipo);
          if (busca) itens = itens.filter((c) => c.nome.toLowerCase().includes(busca));
          return { body: criarLista(itens) };
        },
      },
    ]);
    const { user, router } = renderLista();

    expect((await screen.findAllByText('Maria da Silva')).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('tab', { name: 'Fornecedores' }));
    await waitFor(() => expect(router.state.location.search).toContain('tipo=fornecedor'));
    await waitFor(() => expect(screen.queryByText('Maria da Silva')).not.toBeInTheDocument());
    expect(screen.getAllByText('Papelaria Central').length).toBeGreaterThan(0);
    expect(fetchMock.calls.at(-1)?.url).toContain('tipo=fornecedor');
    expect(fetchMock.calls.at(-1)?.url).toContain('pageSize=25');

    await user.click(screen.getByRole('tab', { name: 'Todos' }));
    await waitFor(() => expect(router.state.location.search).not.toContain('tipo='));

    await user.type(screen.getByRole('searchbox', { name: 'Buscar contatos' }), 'pape');
    await waitFor(() => expect(router.state.location.search).toContain('q=pape'));
    await waitFor(() => expect(fetchMock.calls.at(-1)?.url).toContain('busca=pape'));
    await waitFor(() => expect(screen.queryByText('Maria da Silva')).not.toBeInTheDocument());
  });

  it('mostra estado vazio com chamada para cadastrar', async () => {
    mockFetch([{ method: 'GET', path: '/api/v1/contatos', body: criarLista([]) }]);
    renderLista();

    expect(
      await screen.findByRole('heading', { name: 'Nenhum cliente ou fornecedor ainda' }),
    ).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: 'Novo contato' });
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0]).toHaveAttribute('href', '/contatos/novo');
  });

  it('mostra "nenhum encontrado" quando a busca da URL não retorna nada', async () => {
    mockFetch([{ method: 'GET', path: '/api/v1/contatos', body: criarLista([]) }]);
    renderLista('/contatos?q=zzz');

    expect(
      await screen.findByRole('heading', { name: 'Nenhum contato encontrado' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpar busca' })).toBeInTheDocument();
  });

  it('mostra erro com "Tentar novamente" quando a API falha', async () => {
    mockFetch([{ method: 'GET', path: '/api/v1/contatos', status: 500, body: {} }]);
    renderLista();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });
});
