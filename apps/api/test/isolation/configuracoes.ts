// Isolamento: configuracoes (P1-B). Não tem rota com :id, mas aceita referência a categoria.
import type { RecursoIsolamento } from './_registry.js';

export const recursos: RecursoIsolamento[] = [
  {
    recurso: 'configuracoes',
    rotasCobertas: [],
    async preparar(app, a) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/categorias',
        headers: a.headers,
        payload: { nome: 'Despesa DAS alternativa de A', tipo: 'despesa' },
      });
      if (res.statusCode !== 201) throw new Error(`preparar configuracoes: ${res.body}`);
      return {
        categoriaDespesaId: res.json<{ data: { id: string } }>().data.id,
        tenantIdA: a.tenantId,
        userIdA: a.userId,
      };
    },
    casos: [
      {
        nome: 'PATCH /configuracoes apontando categoriaDasId de A como B → 404/422',
        requisicao: (ids) => ({
          method: 'PATCH',
          url: '/api/v1/configuracoes',
          payload: { categoriaDasId: ids.categoriaDespesaId },
        }),
        status: [404, 422],
      },
      {
        nome: 'GET /configuracoes como B não expõe ids de A',
        requisicao: () => ({ method: 'GET', url: '/api/v1/configuracoes' }),
        status: [200],
        naoDeveConter: (ids) => [ids.tenantIdA!, ids.userIdA!, ids.categoriaDespesaId!],
      },
    ],
  },
];
