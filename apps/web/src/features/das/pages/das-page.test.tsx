import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  criarAlerta,
  criarConfiguracoes,
  criarDasAno,
  criarDasn,
  criarLimite,
} from '@/features/das/test/fixtures';
import { mockFetch } from '@/test/fetch-mock';
import { renderWithProviders } from '@/test/render';

import { DasPage } from './das-page';

function mockRotasBase() {
  return mockFetch([
    { method: 'GET', path: '/api/v1/obrigacoes/alertas', body: { data: [] } },
    { method: 'GET', path: '/api/v1/obrigacoes/das', body: { data: criarDasAno() } },
    { method: 'GET', path: '/api/v1/obrigacoes/dasn', body: { data: criarDasn() } },
    { method: 'GET', path: '/api/v1/obrigacoes/limite', body: { data: criarLimite() } },
    { method: 'GET', path: '/api/v1/configuracoes', body: { data: criarConfiguracoes() } },
  ]);
}

describe('DasPage', () => {
  it('mostra o DAS mensal com o valor de serviços (R$ 86,05) e marca janeiro como pago', async () => {
    const fetchMock = mockRotasBase();
    fetchMock.rota({
      method: 'POST',
      path: /\/api\/v1\/obrigacoes\/das\/2026-01\/pagamento$/,
      status: 201,
      body: {
        data: {
          competencia: {
            competencia: '2026-01',
            devida: true,
            valor: 8605,
            detalhamento: {
              inss: 8105,
              icms: 0,
              iss: 500,
              total: 8605,
              aliquotaInssBp: 500,
              salarioMinimo: 162100,
            },
            vencimento: '2026-02-20',
            status: 'pago',
            diasAtraso: 0,
            pagamento: {
              id: 'pg-1',
              competencia: '2026-01',
              valorCalculado: 8605,
              valorPago: 8605,
              dataPagamento: '2026-09-09',
              formaPagamento: 'pix',
              lancamentoId: 'lc-1',
              observacao: null,
              createdAt: '2026-09-09T12:00:00.000Z',
            },
          },
          lancamento: {
            id: 'lc-1',
            tipo: 'despesa',
            data: '2026-09-09',
            valor: 8605,
            descricao: 'DAS MEI 01/2026',
            categoriaId: 'cat-das',
            categoria: { id: 'cat-das', nome: 'Impostos e DAS', cor: null, icone: null },
            contatoId: null,
            contato: null,
            formaPagamento: 'pix',
            status: 'pago',
            dataPagamento: '2026-09-09',
            observacoes: null,
            anexo: null,
            origem: 'das',
            recorrenciaId: null,
            competencia: '2026-01',
            parcelaId: null,
            importacaoId: null,
            createdAt: '2026-09-09T12:00:00.000Z',
            updatedAt: '2026-09-09T12:00:00.000Z',
          },
        },
      },
    });

    const { user } = renderWithProviders(<DasPage />, { route: '/das' });

    expect(await screen.findAllByText('R$ 86,05')).not.toHaveLength(0);

    // A tabela (desktop) e os cartões (mobile) coexistem no DOM em teste (CSS não é carregado);
    // escopamos pela tabela para não ambiguar o botão.
    const tabela = screen.getByRole('table', { name: 'DAS mensal de 2026' });
    await user.click(
      within(tabela).getByRole('button', { name: 'Marcar DAS de janeiro de 2026 como pago' }),
    );
    const dialogo = await screen.findByRole('dialog');
    await user.click(within(dialogo).getByRole('button', { name: 'Confirmar pagamento' }));

    await waitFor(() =>
      expect(fetchMock.chamadas(/\/das\/2026-01\/pagamento$/, 'POST')).toHaveLength(1),
    );
    expect(fetchMock.chamadas(/\/das\/2026-01\/pagamento$/, 'POST')[0]?.body).toMatchObject({
      valorPago: 8605,
      formaPagamento: 'pix',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('na aba DASN-SIMEI mostra o faturamento apurado e permite declarar a entrega', async () => {
    const fetchMock = mockRotasBase();
    fetchMock.rota({
      method: 'PUT',
      path: /\/api\/v1\/obrigacoes\/dasn\/2025$/,
      body: {
        data: criarDasn({ status: 'entregue', dataEntrega: '2026-05-20', numeroRecibo: '123' }),
      },
    });

    const { user } = renderWithProviders(<DasPage />, { route: '/das' });

    await user.click(await screen.findByRole('tab', { name: 'DASN-SIMEI' }));
    expect(await screen.findByText('Declarar DASN-SIMEI')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Declarar DASN-SIMEI' }));
    const dialogo = await screen.findByRole('dialog');
    await user.click(within(dialogo).getByLabelText('Já entreguei a DASN-SIMEI'));
    fireEvent.change(within(dialogo).getByLabelText('Data de entrega'), {
      target: { value: '2026-05-20' },
    });
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(fetchMock.chamadas(/\/dasn\/2025$/, 'PUT')).toHaveLength(1));
    expect(fetchMock.chamadas(/\/dasn\/2025$/, 'PUT')[0]?.body).toMatchObject({
      status: 'entregue',
      dataEntrega: '2026-05-20',
    });
  });

  it('mostra os alertas de DAS e DASN no topo da página', async () => {
    mockFetch([
      {
        method: 'GET',
        path: '/api/v1/obrigacoes/alertas',
        body: { data: [criarAlerta({ titulo: 'DAS de janeiro vence em breve' })] },
      },
      { method: 'GET', path: '/api/v1/obrigacoes/das', body: { data: criarDasAno() } },
      { method: 'GET', path: '/api/v1/obrigacoes/dasn', body: { data: criarDasn() } },
      { method: 'GET', path: '/api/v1/obrigacoes/limite', body: { data: criarLimite() } },
      { method: 'GET', path: '/api/v1/configuracoes', body: { data: criarConfiguracoes() } },
    ]);

    renderWithProviders(<DasPage />, { route: '/das' });

    expect(await screen.findByText('DAS de janeiro vence em breve')).toBeInTheDocument();
  });
});
