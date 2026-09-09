import type { NotaFiscalDto } from '@meifin/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { criarLista } from '@/test/factories';
import { mockFetch } from '@/test/fetch-mock';
import { renderWithProviders } from '@/test/render';

import { NotasListaPage } from './lista-page';

const RESUMO_VAZIO = {
  data: {
    ano: 2026,
    emitidas: { quantidade: 0, valor: 0 },
    canceladas: { quantidade: 0, valor: 0 },
    semLancamento: { quantidade: 0, valor: 0 },
    porTipo: [],
    porMes: Array.from({ length: 12 }, (_, i) => ({
      competencia: `2026-${String(i + 1).padStart(2, '0')}`,
      quantidade: 0,
      valor: 0,
    })),
  },
};

function criarNota(sobrescrever: Partial<NotaFiscalDto> = {}): NotaFiscalDto {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    tipo: 'nfse',
    numero: '1024',
    serie: '1',
    dataEmissao: '2026-03-10',
    contatoId: null,
    contato: null,
    valor: 50_000,
    descricao: 'Serviço de consultoria',
    status: 'emitida',
    dataCancelamento: null,
    motivoCancelamento: null,
    lancamentoId: '22222222-2222-4222-8222-222222222222',
    linkExterno: null,
    arquivo: null,
    provedor: 'manual',
    chaveAcesso: null,
    protocolo: null,
    createdAt: '2026-03-10T12:00:00.000Z',
    updatedAt: '2026-03-10T12:00:00.000Z',
    ...sobrescrever,
  };
}

function mockBase(itens: NotaFiscalDto[]) {
  return mockFetch([
    { method: 'GET', path: '/api/v1/notas-fiscais/resumo', body: RESUMO_VAZIO },
    { method: 'GET', path: '/api/v1/contatos', body: criarLista([]) },
    {
      method: 'GET',
      path: '/api/v1/notas-fiscais',
      body: {
        ...criarLista(itens),
        totais: { valor: itens.reduce((a, n) => a + n.valor, 0), quantidade: itens.length },
      },
    },
  ]);
}

describe('NotasListaPage', () => {
  it('lista as notas com tipo, status e valor', async () => {
    mockBase([criarNota()]);
    renderWithProviders(<NotasListaPage />, { route: '/notas-fiscais' });

    await screen.findByText('1024');
    const tabela = screen.getByRole('table', { name: 'Notas fiscais' });
    expect(within(tabela).getByText('NFS-e')).toBeInTheDocument();
    expect(within(tabela).getByText('Emitida')).toBeInTheDocument();
    expect(within(tabela).getByText('R$ 500,00')).toBeInTheDocument();
  });

  it('mostra estado vazio com chamada para registrar', async () => {
    mockBase([]);
    renderWithProviders(<NotasListaPage />, { route: '/notas-fiscais' });

    expect(
      await screen.findByRole('heading', { name: 'Nenhuma nota registrada' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Registrar nota' }).length).toBeGreaterThan(0);
  });

  it('abre o diálogo de registrar nota', async () => {
    mockBase([]);
    const { user, router } = renderWithProviders(<NotasListaPage />, { route: '/notas-fiscais' });

    await user.click((await screen.findAllByRole('button', { name: 'Registrar nota' }))[0]!);
    await waitFor(() => expect(router.state.location.search).toContain('novo=1'));
    expect(
      await screen.findByText('Registro manual da nota já emitida (não emite pela SEFAZ).'),
    ).toBeInTheDocument();
  });

  it('abre o detalhe da nota ao clicar na linha', async () => {
    const nota = criarNota();
    mockBase([nota]);
    mockFetch([
      { method: 'GET', path: '/api/v1/notas-fiscais/resumo', body: RESUMO_VAZIO },
      { method: 'GET', path: '/api/v1/contatos', body: criarLista([]) },
      {
        method: 'GET',
        path: '/api/v1/notas-fiscais',
        body: { ...criarLista([nota]), totais: { valor: nota.valor, quantidade: 1 } },
      },
      { method: 'GET', path: `/api/v1/notas-fiscais/${nota.id}`, body: { data: nota } },
    ]);
    const { user } = renderWithProviders(<NotasListaPage />, { route: '/notas-fiscais' });

    const linha = await screen.findByText('1024');
    await user.click(linha);
    expect(await screen.findByText('Nota 1024/1')).toBeInTheDocument();
  });
});
