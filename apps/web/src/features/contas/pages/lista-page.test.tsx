import type { ParcelaComTituloDto } from '@meifin/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { criarLista } from '@/test/factories';
import { mockFetch } from '@/test/fetch-mock';
import { renderWithProviders } from '@/test/render';

import { ContasPagarPage, ContasReceberPage } from './lista-page';

const RESUMO_VAZIO = {
  data: {
    dias: 30,
    pagar: {
      atrasadas: { quantidade: 0, valor: 0 },
      proximas: { quantidade: 0, valor: 0 },
      abertas: { quantidade: 0, valor: 0 },
      pagasNoPeriodo: { quantidade: 0, valor: 0 },
    },
    receber: {
      atrasadas: { quantidade: 0, valor: 0 },
      proximas: { quantidade: 0, valor: 0 },
      abertas: { quantidade: 0, valor: 0 },
      pagasNoPeriodo: { quantidade: 0, valor: 0 },
    },
  },
};

function criarParcela(sobrescrever: Partial<ParcelaComTituloDto> = {}): ParcelaComTituloDto {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    tituloId: '22222222-2222-4222-8222-222222222222',
    numero: 1,
    vencimento: '2026-01-10',
    valor: 15_000,
    status: 'aberta',
    lancamentoId: null,
    dataPagamento: null,
    valorPago: null,
    formaPagamento: null,
    atrasada: true,
    diasAtraso: 5,
    createdAt: '2026-01-01T12:00:00.000Z',
    updatedAt: '2026-01-01T12:00:00.000Z',
    titulo: {
      id: '22222222-2222-4222-8222-222222222222',
      tipo: 'pagar',
      descricao: 'Aluguel da loja',
      contatoId: null,
      contato: null,
      categoriaId: '33333333-3333-4333-8333-333333333333',
      numeroParcelas: 1,
    },
    ...sobrescrever,
  };
}

function mockBase(itens: ParcelaComTituloDto[]) {
  return mockFetch([
    { method: 'GET', path: '/api/v1/parcelas/resumo', body: RESUMO_VAZIO },
    { method: 'GET', path: '/api/v1/contatos', body: criarLista([]) },
    {
      method: 'GET',
      path: '/api/v1/parcelas',
      body: {
        ...criarLista(itens),
        totais: { valor: itens.reduce((a, p) => a + p.valor, 0), atrasado: 0 },
      },
    },
  ]);
}

describe('ContasPagarPage', () => {
  it('agrupa as parcelas por vencimento e mostra o total do grupo', async () => {
    const atrasada = criarParcela();
    const futura = criarParcela({
      id: '44444444-4444-4444-8444-444444444444',
      vencimento: '2026-06-20',
      valor: 20_000,
      atrasada: false,
      diasAtraso: 0,
      titulo: { ...criarParcela().titulo, descricao: 'Internet' },
    });
    mockBase([atrasada, futura]);
    renderWithProviders(<ContasPagarPage />, { route: '/contas/pagar' });

    expect(await screen.findByText('Aluguel da loja')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Contas a pagar' })).toBeInTheDocument();
    const grupoVencidas = screen.getByLabelText('Vencidas');
    expect(within(grupoVencidas).getByText('Aluguel da loja')).toBeInTheDocument();
    expect(screen.getByText('Internet')).toBeInTheDocument();
  });

  it('mostra estado vazio com chamada para nova conta', async () => {
    mockBase([]);
    renderWithProviders(<ContasPagarPage />, { route: '/contas/pagar' });

    expect(
      await screen.findByRole('heading', { name: 'Nenhuma conta a pagar em aberto.' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Nova conta a pagar' }).length).toBeGreaterThan(0);
  });

  it('abre a baixa rápida a partir da linha', async () => {
    mockFetch([
      { method: 'GET', path: '/api/v1/parcelas/resumo', body: RESUMO_VAZIO },
      { method: 'GET', path: '/api/v1/contatos', body: criarLista([]) },
      {
        method: 'GET',
        path: '/api/v1/parcelas',
        body: { ...criarLista([criarParcela()]), totais: { valor: 15_000, atrasado: 15_000 } },
      },
      {
        method: 'GET',
        path: /\/api\/v1\/parcelas\/[0-9a-f-]+$/,
        body: { data: criarParcela() },
      },
    ]);
    const { user, router } = renderWithProviders(<ContasPagarPage />, { route: '/contas/pagar' });

    await user.click(await screen.findByRole('button', { name: 'Pagar' }));
    await waitFor(() => expect(router.state.location.search).toContain('pagar='));
    expect(await screen.findByText('Pagar parcela')).toBeInTheDocument();
  });
});

describe('ContasReceberPage', () => {
  it('mostra o título "Contas a receber"', async () => {
    mockBase([]);
    renderWithProviders(<ContasReceberPage />, { route: '/contas/receber' });
    expect(await screen.findByRole('heading', { name: 'Contas a receber' })).toBeInTheDocument();
  });
});
