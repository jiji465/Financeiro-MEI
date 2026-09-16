import type { ContaBancariaSaldoDto } from '@meifin/shared';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mockFetch } from '@/test/fetch-mock';
import { renderWithProviders } from '@/test/render';

import { ContasBancariasListaPage } from './lista-page';

function criarConta(sobrescrever: Partial<ContaBancariaSaldoDto> = {}): ContaBancariaSaldoDto {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    nome: 'Nubank PJ',
    instituicao: 'Nu Pagamentos S.A.',
    tipo: 'corrente',
    saldoInicial: 100_000,
    ativo: true,
    saldo: 170_000,
    receitas: 100_000,
    despesas: 30_000,
    transferenciasEntrada: 0,
    transferenciasSaida: 0,
    lancamentos: 3,
    createdAt: '2026-01-10T12:00:00.000Z',
    updatedAt: '2026-01-10T12:00:00.000Z',
    ...sobrescrever,
  };
}

describe('ContasBancariasListaPage', () => {
  it('mostra o saldo de cada conta e o total', async () => {
    mockFetch([
      {
        path: '/api/v1/contas-bancarias',
        body: {
          data: [
            criarConta(),
            criarConta({
              id: '22222222-2222-4222-8222-222222222222',
              nome: 'Caixa da loja',
              instituicao: null,
              tipo: 'dinheiro',
              saldoInicial: 5_000,
              saldo: -1_500,
              receitas: 0,
              despesas: 6_500,
              lancamentos: 1,
            }),
          ],
          totais: { saldoInicial: 105_000, saldo: 168_500 },
        },
      },
    ]);

    renderWithProviders(<ContasBancariasListaPage />, { route: '/contas-bancarias' });

    // A tabela (desktop) e o cartão (mobile) são renderizados juntos e escondidos por CSS.
    await waitFor(() => expect(screen.getAllByText('Nubank PJ').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Caixa da loja').length).toBeGreaterThan(0);
    // Saldo por conta (o negativo vem com o sinal) e total somado.
    expect(screen.getAllByText('R$ 1.700,00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('-R$ 15,00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('R$ 1.685,00').length).toBeGreaterThan(0);
  });

  it('sem contas cadastradas, convida a cadastrar a primeira', async () => {
    mockFetch([
      {
        path: '/api/v1/contas-bancarias',
        body: { data: [], totais: { saldoInicial: 0, saldo: 0 } },
      },
    ]);

    renderWithProviders(<ContasBancariasListaPage />, { route: '/contas-bancarias' });

    await waitFor(() => expect(screen.getByText('Nenhuma conta cadastrada')).toBeInTheDocument());
  });
});
