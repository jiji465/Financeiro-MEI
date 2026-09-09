// Isolamento: categorias (P1-B).
import type { RecursoIsolamento } from './_registry.js';

export const recursos: RecursoIsolamento[] = [
  {
    recurso: 'categorias',
    rotasCobertas: [
      'GET /api/v1/categorias/:id',
      'PATCH /api/v1/categorias/:id',
      'DELETE /api/v1/categorias/:id',
    ],
    async preparar(app, a) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/categorias',
        headers: a.headers,
        payload: { nome: 'Categoria secreta de A', tipo: 'despesa' },
      });
      if (res.statusCode !== 201) throw new Error(`preparar categorias: ${res.body}`);
      return { categoriaId: res.json<{ data: { id: string } }>().data.id, tenantIdA: a.tenantId };
    },
    casos: [
      {
        nome: 'GET /categorias/:id de A como B → 404',
        requisicao: (ids) => ({ method: 'GET', url: `/api/v1/categorias/${ids.categoriaId}` }),
      },
      {
        nome: 'PATCH /categorias/:id de A como B → 404',
        requisicao: (ids) => ({
          method: 'PATCH',
          url: `/api/v1/categorias/${ids.categoriaId}`,
          payload: { nome: 'Invadida' },
        }),
      },
      {
        nome: 'DELETE /categorias/:id de A como B → 404',
        requisicao: (ids) => ({ method: 'DELETE', url: `/api/v1/categorias/${ids.categoriaId}` }),
      },
      {
        nome: 'GET /categorias como B não lista a categoria de A',
        requisicao: () => ({ method: 'GET', url: '/api/v1/categorias?incluirInativas=true' }),
        status: [200],
        naoDeveConter: (ids) => [ids.categoriaId!],
      },
    ],
  },
];
