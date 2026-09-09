// Isolamento: títulos e parcelas (WP3). Tenant B nunca enxerga/altera contas do tenant A,
// e não consegue criar uma conta apontando para categoria/contato de A.
import type { RecursoIsolamento } from './_registry.js';

interface Cat {
  id: string;
  tipo: 'receita' | 'despesa';
}

export const recursos: RecursoIsolamento[] = [
  {
    recurso: 'titulos',
    rotasCobertas: [
      'GET /api/v1/titulos/:id',
      'PATCH /api/v1/titulos/:id',
      'DELETE /api/v1/titulos/:id',
      'GET /api/v1/parcelas/:id',
      'PATCH /api/v1/parcelas/:id',
      'POST /api/v1/parcelas/:id/baixa',
      'DELETE /api/v1/parcelas/:id/baixa',
    ],
    async preparar(app, a) {
      const cats = await app.inject({
        method: 'GET',
        url: '/api/v1/categorias',
        headers: a.headers,
      });
      const despesa = cats.json<{ data: Cat[] }>().data.find((c) => c.tipo === 'despesa')!;
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/titulos',
        headers: a.headers,
        payload: {
          tipo: 'pagar',
          descricao: 'Conta secreta de A',
          categoriaId: despesa.id,
          valorTotal: 3_000,
          parcelas: { quantidade: 2, primeiroVencimento: '2026-01-10' },
        },
      });
      if (res.statusCode !== 201) throw new Error(`preparar titulos: ${res.body}`);
      const titulo = res.json<{ data: { id: string; parcelas: { id: string }[] } }>().data;
      const [aberta, paga] = titulo.parcelas;
      const baixa = await app.inject({
        method: 'POST',
        url: `/api/v1/parcelas/${paga!.id}/baixa`,
        headers: a.headers,
        payload: {},
      });
      if (baixa.statusCode !== 201) throw new Error(`preparar baixa: ${baixa.body}`);
      return {
        tituloId: titulo.id,
        parcelaAbertaId: aberta!.id,
        parcelaPagaId: paga!.id,
        categoriaDespesaA: despesa.id,
      };
    },
    casos: [
      {
        nome: 'GET /titulos/:id de A como B → 404',
        requisicao: (ids) => ({ method: 'GET', url: `/api/v1/titulos/${ids.tituloId}` }),
      },
      {
        nome: 'PATCH /titulos/:id de A como B → 404',
        requisicao: (ids) => ({
          method: 'PATCH',
          url: `/api/v1/titulos/${ids.tituloId}`,
          payload: { descricao: 'Invadida' },
        }),
      },
      {
        nome: 'DELETE /titulos/:id de A como B → 404',
        requisicao: (ids) => ({ method: 'DELETE', url: `/api/v1/titulos/${ids.tituloId}` }),
      },
      {
        nome: 'GET /parcelas/:id de A como B → 404',
        requisicao: (ids) => ({ method: 'GET', url: `/api/v1/parcelas/${ids.parcelaAbertaId}` }),
      },
      {
        nome: 'PATCH /parcelas/:id de A como B → 404',
        requisicao: (ids) => ({
          method: 'PATCH',
          url: `/api/v1/parcelas/${ids.parcelaAbertaId}`,
          payload: { valor: 1 },
        }),
      },
      {
        nome: 'POST /parcelas/:id/baixa de A como B → 404',
        requisicao: (ids) => ({
          method: 'POST',
          url: `/api/v1/parcelas/${ids.parcelaAbertaId}/baixa`,
          payload: {},
        }),
      },
      {
        nome: 'DELETE /parcelas/:id/baixa (estorno) de A como B → 404',
        requisicao: (ids) => ({
          method: 'DELETE',
          url: `/api/v1/parcelas/${ids.parcelaPagaId}/baixa`,
        }),
      },
      {
        nome: 'POST /titulos como B com categoria de A → 404',
        requisicao: (ids) => ({
          method: 'POST',
          url: '/api/v1/titulos',
          payload: {
            tipo: 'pagar',
            descricao: 'Tentativa',
            categoriaId: ids.categoriaDespesaA,
            valorTotal: 100,
            parcelas: { quantidade: 1, primeiroVencimento: '2026-02-01' },
          },
        }),
      },
      {
        nome: 'GET /titulos como B não lista a conta de A',
        requisicao: () => ({ method: 'GET', url: '/api/v1/titulos' }),
        status: [200],
        naoDeveConter: (ids) => [ids.tituloId!, ids.parcelaAbertaId!],
      },
      {
        nome: 'GET /parcelas como B não lista as parcelas de A',
        requisicao: () => ({ method: 'GET', url: '/api/v1/parcelas' }),
        status: [200],
        naoDeveConter: (ids) => [ids.parcelaAbertaId!, ids.parcelaPagaId!, ids.tituloId!],
      },
      {
        nome: 'GET /parcelas/resumo como B zera (nada de A entra na soma)',
        requisicao: () => ({ method: 'GET', url: '/api/v1/parcelas/resumo' }),
        status: [200],
      },
    ],
  },
];
