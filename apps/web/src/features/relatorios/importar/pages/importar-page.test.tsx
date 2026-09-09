import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mockFetch } from '@/test/fetch-mock';
import { renderWithProviders } from '@/test/render';

import { ImportarCsvPage } from './importar-page';

const CSV = [
  'DataMovimento;ValorPago;Historico',
  '2026-09-01;150,00;Venda de bolos',
  '2026-09-02;50,00;Compra de insumos',
].join('\r\n');

function criarArquivo(): File {
  return new File([CSV], 'extrato.csv', { type: 'text/csv' });
}

const PREVIEW_RESPOSTA = {
  data: {
    nomeArquivo: 'extrato.csv',
    delimitador: ';',
    cabecalho: ['DataMovimento', 'ValorPago', 'Historico'],
    totalLinhas: 2,
    validas: 2,
    comErro: 0,
    duplicadas: 0,
    linhas: [
      {
        numero: 1,
        data: '2026-09-01',
        valor: 15_000,
        descricao: 'Venda de bolos',
        tipo: 'receita',
        categoriaId: '33333333-3333-4333-8333-333333333333',
        categoriaNome: 'Vendas',
        contatoId: null,
        contatoNome: null,
        formaPagamento: null,
        status: 'pago',
        observacoes: null,
        hash: 'a'.repeat(64),
        duplicada: false,
        erro: null,
        bruto: {},
      },
      {
        numero: 2,
        data: '2026-09-02',
        valor: 5_000,
        descricao: 'Compra de insumos',
        tipo: 'receita',
        categoriaId: '33333333-3333-4333-8333-333333333333',
        categoriaNome: 'Vendas',
        contatoId: null,
        contatoNome: null,
        formaPagamento: null,
        status: 'pago',
        observacoes: null,
        hash: 'b'.repeat(64),
        duplicada: false,
        erro: null,
        bruto: {},
      },
    ],
  },
};

const CONFIRMAR_RESPOSTA = {
  data: {
    id: '44444444-4444-4444-8444-444444444444',
    nomeArquivo: 'extrato.csv',
    formato: 'csv',
    totalLinhas: 2,
    importadas: 2,
    ignoradas: 0,
    duplicadas: 0,
    mapeamento: {},
    createdAt: '2026-09-09T12:00:00.000Z',
  },
};

function mockBase() {
  return mockFetch([
    { method: 'GET', path: '/api/v1/categorias', body: { data: [] } },
    { method: 'POST', path: '/api/v1/importacoes/csv/preview', body: PREVIEW_RESPOSTA },
    {
      method: 'POST',
      path: '/api/v1/importacoes/csv/confirmar',
      status: 201,
      body: CONFIRMAR_RESPOSTA,
    },
  ]);
}

describe('ImportarCsvPage', () => {
  it('percorre o assistente: envio do arquivo, mapeamento, pré-visualização e confirmação', async () => {
    mockBase();
    const { user } = renderWithProviders(<ImportarCsvPage />, { route: '/relatorios/importar' });

    expect(screen.getByRole('heading', { name: 'Importar CSV' })).toBeInTheDocument();

    const input = screen.getByLabelText('Escolher arquivo', { selector: 'input' });
    await user.upload(input, criarArquivo());

    expect(await screen.findByText(/extrato\.csv/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pré-visualizar' }));

    expect(await screen.findByText('Prontas para importar')).toBeInTheDocument();
    const botaoImportar = await screen.findByRole('button', { name: /Importar 2 lançamento/ });
    await user.click(botaoImportar);

    expect(await screen.findByText('Importação concluída')).toBeInTheDocument();
    expect(screen.getByText(/2 lançamento\(s\) criado\(s\)/)).toBeInTheDocument();
  });

  it('mostra erro para um arquivo sem cabeçalho reconhecível', async () => {
    mockBase();
    const { user } = renderWithProviders(<ImportarCsvPage />, { route: '/relatorios/importar' });

    const input = screen.getByLabelText('Escolher arquivo', { selector: 'input' });
    const vazio = new File([''], 'vazio.csv', { type: 'text/csv' });
    await user.upload(input, vazio);

    expect(await screen.findByText(/Não encontramos um cabeçalho válido/)).toBeInTheDocument();
  });

  it('registra a rota /relatorios/importar via lancamentosModule', async () => {
    const { lancamentosModule } = await import('@/features/lancamentos');
    expect(lancamentosModule.routes.some((r) => r.path === '/relatorios/importar')).toBe(true);
  });
});
