// Isolamento: contas bancárias. Cria uma conta como A e confere que B recebe 404 em todas as
// rotas com :id, que a listagem/opções de B não vazam o id de A, que B pode usar o mesmo nome
// (a unicidade é por tenant) e — o ponto do vínculo novo — que B não consegue lançar dinheiro
// numa conta de A nem filtrar lançamentos por ela.
import type { RecursoIsolamento } from './_registry.js';

export const recursos: RecursoIsolamento[] = [
  {
    recurso: 'contas-bancarias',
    rotasCobertas: [
      'GET /api/v1/contas-bancarias/:id',
      'PATCH /api/v1/contas-bancarias/:id',
      'DELETE /api/v1/contas-bancarias/:id',
      'DELETE /api/v1/contas-bancarias/transferencias/:id',
    ],
    async preparar(app, a) {
      const criarConta = async (nome: string) => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/contas-bancarias',
          headers: a.headers,
          payload: { nome, instituicao: 'Banco Secreto', tipo: 'corrente', saldoInicial: 100_000 },
        });
        if (res.statusCode !== 201) throw new Error(`preparar contas-bancarias: ${res.body}`);
        return res.json<{ data: { id: string } }>().data.id;
      };
      const contaId = await criarConta('Conta secreta de A');
      const contaDestinoId = await criarConta('Segunda conta secreta de A');

      const transferencia = await app.inject({
        method: 'POST',
        url: '/api/v1/contas-bancarias/transferencias',
        headers: a.headers,
        payload: {
          data: '2026-06-10',
          valor: 20_000,
          contaOrigemId: contaId,
          contaDestinoId,
          descricao: 'Transferência secreta de A',
        },
      });
      if (transferencia.statusCode !== 201) {
        throw new Error(`preparar transferencias: ${transferencia.body}`);
      }
      const transferenciaId = transferencia.json<{ data: { id: string } }>().data.id;

      const cats = await app.inject({
        method: 'GET',
        url: '/api/v1/categorias?tipo=receita',
        headers: a.headers,
      });
      const categoriaId = cats.json<{ data: { id: string }[] }>().data[0]!.id;

      return { contaId, contaDestinoId, transferenciaId, categoriaId, tenantIdA: a.tenantId };
    },
    casos: [
      {
        nome: 'GET /contas-bancarias/:id de A como B → 404',
        requisicao: (ids) => ({ method: 'GET', url: `/api/v1/contas-bancarias/${ids.contaId}` }),
      },
      {
        nome: 'PATCH /contas-bancarias/:id de A como B → 404',
        requisicao: (ids) => ({
          method: 'PATCH',
          url: `/api/v1/contas-bancarias/${ids.contaId}`,
          payload: { nome: 'Invadida', saldoInicial: 999_999 },
        }),
      },
      {
        nome: 'DELETE /contas-bancarias/:id de A como B → 404',
        requisicao: (ids) => ({ method: 'DELETE', url: `/api/v1/contas-bancarias/${ids.contaId}` }),
      },
      {
        nome: 'GET /contas-bancarias como B não lista a conta de A',
        requisicao: () => ({ method: 'GET', url: '/api/v1/contas-bancarias' }),
        status: [200],
        naoDeveConter: (ids) => [ids.contaId!, 'Conta secreta de A'],
      },
      {
        nome: 'GET /contas-bancarias/opcoes como B não lista a conta de A',
        requisicao: () => ({ method: 'GET', url: '/api/v1/contas-bancarias/opcoes' }),
        status: [200],
        naoDeveConter: (ids) => [ids.contaId!],
      },
      {
        nome: 'POST /contas-bancarias como B com o mesmo nome → 201 (unicidade é por tenant)',
        requisicao: () => ({
          method: 'POST',
          url: '/api/v1/contas-bancarias',
          payload: { nome: 'Conta secreta de A', tipo: 'corrente', saldoInicial: 0 },
        }),
        status: [201],
        naoDeveConter: (ids) => [ids.contaId!],
      },
      {
        nome: 'POST /lancamentos como B apontando para a conta de A → 404',
        requisicao: (ids) => ({
          method: 'POST',
          url: '/api/v1/lancamentos',
          payload: {
            tipo: 'receita',
            data: '2026-06-10',
            valor: 10_000,
            descricao: 'Tentativa de lançar na conta de A',
            categoriaId: ids.categoriaId,
            contaBancariaId: ids.contaId,
            status: 'pago',
          },
        }),
        // 404 pela validação do core; 422 se a FK composta barrar antes.
        status: [404, 422],
      },
      {
        nome: 'GET /lancamentos?contaBancariaId=<conta de A> como B não devolve nada de A',
        requisicao: (ids) => ({
          method: 'GET',
          url: `/api/v1/lancamentos?contaBancariaId=${ids.contaId}`,
        }),
        status: [200],
        naoDeveConter: (ids) => [ids.contaId!],
      },
      {
        nome: 'DELETE /contas-bancarias/transferencias/:id de A como B → 404',
        requisicao: (ids) => ({
          method: 'DELETE',
          url: `/api/v1/contas-bancarias/transferencias/${ids.transferenciaId}`,
        }),
      },
      {
        nome: 'GET /contas-bancarias/transferencias como B não lista a de A',
        requisicao: () => ({ method: 'GET', url: '/api/v1/contas-bancarias/transferencias' }),
        status: [200],
        naoDeveConter: (ids) => [ids.transferenciaId!, 'Transferência secreta de A'],
      },
      {
        nome: 'POST transferência como B usando as contas de A → 404',
        requisicao: (ids) => ({
          method: 'POST',
          url: '/api/v1/contas-bancarias/transferencias',
          payload: {
            data: '2026-06-11',
            valor: 5_000,
            contaOrigemId: ids.contaId,
            contaDestinoId: ids.contaDestinoId,
          },
        }),
        status: [404, 422],
      },
    ],
  },
];
