// Isolamento: catálogo de produtos/serviços. Cria um produto como A e confere que B recebe 404
// em todas as rotas com :id, que a listagem/opções de B não vazam nada de A, que B pode usar o
// mesmo nome (a unicidade é por tenant) e — o ponto dos itens — que B não consegue vender um
// produto de A nem em um lançamento novo nem editando um lançamento dele.
import type { RecursoIsolamento } from './_registry.js';

export const recursos: RecursoIsolamento[] = [
  {
    recurso: 'produtos-servicos',
    rotasCobertas: [
      'GET /api/v1/produtos-servicos/:id',
      'PATCH /api/v1/produtos-servicos/:id',
      'DELETE /api/v1/produtos-servicos/:id',
    ],
    async preparar(app, a) {
      const produto = await app.inject({
        method: 'POST',
        url: '/api/v1/produtos-servicos',
        headers: a.headers,
        payload: {
          tipo: 'produto',
          nome: 'Bolo secreto de A',
          descricao: 'Receita da família',
          precoPadrao: 4_500,
          unidade: 'un',
        },
      });
      if (produto.statusCode !== 201)
        throw new Error(`preparar produtos-servicos: ${produto.body}`);
      const produtoId = produto.json<{ data: { id: string } }>().data.id;

      const cats = await app.inject({
        method: 'GET',
        url: '/api/v1/categorias?tipo=receita',
        headers: a.headers,
      });
      const categoriaId = cats.json<{ data: { id: string }[] }>().data[0]!.id;

      // Venda de A com o produto de A: o id do lançamento também não pode vazar para B.
      const venda = await app.inject({
        method: 'POST',
        url: '/api/v1/lancamentos',
        headers: a.headers,
        payload: {
          tipo: 'receita',
          data: '2026-06-10',
          valor: 9_000,
          descricao: 'Venda secreta de A',
          categoriaId,
          status: 'pago',
          itens: [{ produtoServicoId: produtoId, quantidade: 2000, valorUnitario: 4_500 }],
        },
      });
      if (venda.statusCode !== 201) throw new Error(`preparar venda de A: ${venda.body}`);

      return {
        produtoId,
        categoriaId,
        lancamentoId: venda.json<{ data: { id: string } }>().data.id,
      };
    },
    casos: [
      {
        nome: 'GET /produtos-servicos/:id de A como B → 404',
        requisicao: (ids) => ({ method: 'GET', url: `/api/v1/produtos-servicos/${ids.produtoId}` }),
      },
      {
        nome: 'PATCH /produtos-servicos/:id de A como B → 404',
        requisicao: (ids) => ({
          method: 'PATCH',
          url: `/api/v1/produtos-servicos/${ids.produtoId}`,
          payload: { nome: 'Invadido', precoPadrao: 1 },
        }),
      },
      {
        nome: 'DELETE /produtos-servicos/:id de A como B → 404',
        requisicao: (ids) => ({
          method: 'DELETE',
          url: `/api/v1/produtos-servicos/${ids.produtoId}`,
        }),
      },
      {
        nome: 'GET /produtos-servicos como B não lista o produto de A',
        requisicao: () => ({ method: 'GET', url: '/api/v1/produtos-servicos' }),
        status: [200],
        naoDeveConter: (ids) => [ids.produtoId!, 'Bolo secreto de A'],
      },
      {
        nome: 'GET /produtos-servicos/opcoes como B não lista o produto de A',
        requisicao: () => ({ method: 'GET', url: '/api/v1/produtos-servicos/opcoes' }),
        status: [200],
        naoDeveConter: (ids) => [ids.produtoId!],
      },
      {
        nome: 'POST /produtos-servicos como B com o mesmo nome → 201 (unicidade é por tenant)',
        requisicao: () => ({
          method: 'POST',
          url: '/api/v1/produtos-servicos',
          payload: { tipo: 'produto', nome: 'Bolo secreto de A', precoPadrao: 100 },
        }),
        status: [201],
        naoDeveConter: (ids) => [ids.produtoId!],
      },
      {
        nome: 'POST /lancamentos como B vendendo o produto de A → 404',
        requisicao: (ids) => ({
          method: 'POST',
          url: '/api/v1/lancamentos',
          payload: {
            tipo: 'receita',
            data: '2026-06-10',
            valor: 4_500,
            descricao: 'Tentativa de vender o produto de A',
            categoriaId: ids.categoriaId,
            status: 'pago',
            itens: [{ produtoServicoId: ids.produtoId, quantidade: 1000, valorUnitario: 4_500 }],
          },
        }),
        // 404 pela validação do serviço; 422 se a FK composta barrar antes.
        status: [404, 422],
      },
      {
        nome: 'PATCH /lancamentos/:id de A como B (com item de A) → 404',
        requisicao: (ids) => ({
          method: 'PATCH',
          url: `/api/v1/lancamentos/${ids.lancamentoId}`,
          payload: {
            valor: 4_500,
            itens: [{ produtoServicoId: ids.produtoId, quantidade: 1000, valorUnitario: 4_500 }],
          },
        }),
      },
      {
        nome: 'GET /lancamentos como B não devolve a venda de A nem os itens dela',
        requisicao: () => ({ method: 'GET', url: '/api/v1/lancamentos' }),
        status: [200],
        naoDeveConter: (ids) => [ids.produtoId!, ids.lancamentoId!, 'Venda secreta de A'],
      },
    ],
  },
];
