import type { LancamentoDto } from '@meifin/shared';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { criarLista } from '@/test/factories';
import { mockFetch } from '@/test/fetch-mock';
import { renderWithProviders } from '@/test/render';

import { LancamentosListaPage } from './lista-page';

const RESUMO_VAZIO = {
  data: {
    periodo: { de: '2026-09-01', ate: '2026-09-30' },
    receitas: { pagos: 0, pendentes: 0, total: 0, quantidade: 0 },
    despesas: { pagos: 0, pendentes: 0, total: 0, quantidade: 0 },
    saldo: 0,
    saldoPrevisto: 0,
  },
};

function criarLancamento(sobrescrever: Partial<LancamentoDto> = {}): LancamentoDto {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    tipo: 'receita',
    data: '2026-09-05',
    valor: 50_000,
    descricao: 'Venda de bolos',
    categoriaId: '22222222-2222-4222-8222-222222222222',
    categoria: {
      id: '22222222-2222-4222-8222-222222222222',
      nome: 'Vendas',
      cor: '#22c55e',
      icone: null,
    },
    contatoId: null,
    contato: null,
    formaPagamento: 'pix',
    status: 'pago',
    dataPagamento: '2026-09-05',
    observacoes: null,
    anexo: null,
    origem: 'manual',
    recorrenciaId: null,
    competencia: null,
    parcelaId: null,
    importacaoId: null,
    createdAt: '2026-09-05T12:00:00.000Z',
    updatedAt: '2026-09-05T12:00:00.000Z',
    ...sobrescrever,
  };
}

function mockBase(itens: LancamentoDto[]) {
  return mockFetch([
    { method: 'GET', path: '/api/v1/lancamentos/resumo', body: RESUMO_VAZIO },
    { method: 'GET', path: '/api/v1/categorias', body: { data: [] } },
    { method: 'GET', path: '/api/v1/contatos', body: criarLista([]) },
    {
      method: 'GET',
      path: '/api/v1/lancamentos',
      body: {
        ...criarLista(itens),
        totais: {
          receitas: itens.filter((i) => i.tipo === 'receita').reduce((a, i) => a + i.valor, 0),
          despesas: itens.filter((i) => i.tipo === 'despesa').reduce((a, i) => a + i.valor, 0),
          saldo: 0,
        },
      },
    },
  ]);
}

describe('LancamentosListaPage', () => {
  it('lista os lançamentos do período com o título e o valor', async () => {
    mockBase([criarLancamento()]);
    renderWithProviders(<LancamentosListaPage />, { route: '/lancamentos' });

    expect(screen.getByRole('heading', { name: 'Lançamentos' })).toBeInTheDocument();
    expect((await screen.findAllByText('Venda de bolos')).length).toBeGreaterThan(0);
  });

  it('mostra estado vazio com atalho para nova receita e importação', async () => {
    mockBase([]);
    renderWithProviders(<LancamentosListaPage />, { route: '/lancamentos' });

    expect(await screen.findByText('Nenhum lançamento neste período')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Importar CSV' }).length).toBeGreaterThan(0);
  });

  it('abre o drawer de nova receita ao clicar no botão do cabeçalho', async () => {
    mockBase([]);
    const { user, router } = renderWithProviders(<LancamentosListaPage />, {
      route: '/lancamentos',
    });

    await screen.findByText('Nenhum lançamento neste período');
    const botoes = screen.getAllByRole('button', { name: 'Nova receita' });
    await user.click(botoes[0]!);

    await waitFor(() => expect(router.state.location.search).toContain('novo=receita'));
    expect(await screen.findByRole('heading', { name: 'Nova receita' })).toBeInTheDocument();
  });

  it('abre a edição a partir da linha da tabela', async () => {
    const lancamento = criarLancamento();
    const fetchMock = mockBase([lancamento]);
    fetchMock.rota({
      method: 'GET',
      path: `/api/v1/lancamentos/${lancamento.id}`,
      body: { data: lancamento },
    });
    const { user, router } = renderWithProviders(<LancamentosListaPage />, {
      route: '/lancamentos',
    });

    const linhas = await screen.findAllByText('Venda de bolos');
    await user.click(linhas[0]!);
    await waitFor(() => expect(router.state.location.search).toContain(`editar=${lancamento.id}`));
    expect(await screen.findByRole('heading', { name: 'Editar lançamento' })).toBeInTheDocument();
  });
});
