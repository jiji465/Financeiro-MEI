// Isolamento: lançamentos e recorrências (WP2).
import type { RecursoIsolamento } from './_registry.js';

async function categoriaDe(
  app: Parameters<RecursoIsolamento['preparar']>[0],
  a: Parameters<RecursoIsolamento['preparar']>[1],
  tipo: 'receita' | 'despesa',
): Promise<string> {
  const res = await app.inject({
    method: 'GET',
    url: `/api/v1/categorias?tipo=${tipo}`,
    headers: a.headers,
  });
  const cat = res.json<{ data: { id: string }[] }>().data[0];
  if (!cat) throw new Error('preparar lancamentos: tenant A sem categorias');
  return cat.id;
}

export const recursos: RecursoIsolamento[] = [
  {
    recurso: 'lancamentos',
    rotasCobertas: [
      'GET /api/v1/lancamentos/:id',
      'PATCH /api/v1/lancamentos/:id',
      'DELETE /api/v1/lancamentos/:id',
      'POST /api/v1/lancamentos/:id/pagar',
      'POST /api/v1/lancamentos/:id/anexo',
      'GET /api/v1/lancamentos/:id/anexo',
      'DELETE /api/v1/lancamentos/:id/anexo',
    ],
    async preparar(app, a) {
      const categoriaId = await categoriaDe(app, a, 'receita');
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/lancamentos',
        headers: a.headers,
        payload: {
          tipo: 'receita',
          data: '2026-09-01',
          valor: 12_345,
          descricao: 'Lançamento secreto de A',
          categoriaId,
          status: 'pendente',
        },
      });
      if (res.statusCode !== 201) throw new Error(`preparar lancamentos: ${res.body}`);
      return {
        lancamentoId: res.json<{ data: { id: string } }>().data.id,
        categoriaIdA: categoriaId,
      };
    },
    casos: [
      {
        nome: 'GET /lancamentos/:id de A como B → 404',
        requisicao: (ids) => ({ method: 'GET', url: `/api/v1/lancamentos/${ids.lancamentoId}` }),
      },
      {
        nome: 'PATCH /lancamentos/:id de A como B → 404',
        requisicao: (ids) => ({
          method: 'PATCH',
          url: `/api/v1/lancamentos/${ids.lancamentoId}`,
          payload: { descricao: 'Invadido' },
        }),
      },
      {
        nome: 'DELETE /lancamentos/:id de A como B → 404',
        requisicao: (ids) => ({ method: 'DELETE', url: `/api/v1/lancamentos/${ids.lancamentoId}` }),
      },
      {
        nome: 'POST /lancamentos/:id/pagar de A como B → 404',
        requisicao: (ids) => ({
          method: 'POST',
          url: `/api/v1/lancamentos/${ids.lancamentoId}/pagar`,
          payload: {},
        }),
      },
      {
        nome: 'POST /lancamentos/:id/anexo de A como B → 404 (ou 400 antes de ler o arquivo)',
        requisicao: (ids) => ({
          method: 'POST',
          url: `/api/v1/lancamentos/${ids.lancamentoId}/anexo`,
          headers: { 'content-type': 'multipart/form-data; boundary=x' },
          payload:
            '--x\r\nContent-Disposition: form-data; name="arquivo"; filename="a.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF\r\n--x--\r\n',
        }),
        status: [404],
      },
      {
        nome: 'GET /lancamentos/:id/anexo de A como B → 404',
        requisicao: (ids) => ({
          method: 'GET',
          url: `/api/v1/lancamentos/${ids.lancamentoId}/anexo`,
        }),
      },
      {
        nome: 'DELETE /lancamentos/:id/anexo de A como B → 404',
        requisicao: (ids) => ({
          method: 'DELETE',
          url: `/api/v1/lancamentos/${ids.lancamentoId}/anexo`,
        }),
      },
      {
        nome: 'POST /lancamentos como B com categoria de A → 404',
        requisicao: (ids) => ({
          method: 'POST',
          url: '/api/v1/lancamentos',
          payload: {
            tipo: 'receita',
            data: '2026-09-01',
            valor: 100,
            descricao: 'tentativa',
            categoriaId: ids.categoriaIdA,
          },
        }),
      },
      {
        nome: 'GET /lancamentos como B não lista o lançamento de A',
        requisicao: () => ({ method: 'GET', url: '/api/v1/lancamentos?pageSize=200' }),
        status: [200],
        naoDeveConter: (ids) => [ids.lancamentoId!],
      },
      {
        nome: 'GET /lancamentos/resumo como B zera',
        requisicao: () => ({
          method: 'GET',
          url: '/api/v1/lancamentos/resumo?de=2026-01-01&ate=2026-12-31',
        }),
        status: [200],
        naoDeveConter: () => ['12345'],
      },
    ],
  },
  {
    recurso: 'recorrencias',
    rotasCobertas: [
      'GET /api/v1/recorrencias/:id',
      'PATCH /api/v1/recorrencias/:id',
      'DELETE /api/v1/recorrencias/:id',
    ],
    async preparar(app, a) {
      const categoriaId = await categoriaDe(app, a, 'despesa');
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/recorrencias',
        headers: a.headers,
        payload: {
          tipo: 'despesa',
          valor: 5_000,
          descricao: 'Recorrência secreta de A',
          categoriaId,
          diaDoMes: 10,
          dataInicio: '2026-09-01',
        },
      });
      if (res.statusCode !== 201) throw new Error(`preparar recorrencias: ${res.body}`);
      return { recorrenciaId: res.json<{ data: { id: string } }>().data.id };
    },
    casos: [
      {
        nome: 'GET /recorrencias/:id de A como B → 404',
        requisicao: (ids) => ({ method: 'GET', url: `/api/v1/recorrencias/${ids.recorrenciaId}` }),
      },
      {
        nome: 'PATCH /recorrencias/:id de A como B → 404',
        requisicao: (ids) => ({
          method: 'PATCH',
          url: `/api/v1/recorrencias/${ids.recorrenciaId}`,
          payload: { ativo: false },
        }),
      },
      {
        nome: 'DELETE /recorrencias/:id de A como B → 404',
        requisicao: (ids) => ({
          method: 'DELETE',
          url: `/api/v1/recorrencias/${ids.recorrenciaId}`,
        }),
      },
      {
        nome: 'POST /recorrencias/gerar como B para a recorrência de A → 404',
        requisicao: (ids) => ({
          method: 'POST',
          url: '/api/v1/recorrencias/gerar',
          payload: { recorrenciaId: ids.recorrenciaId },
        }),
      },
      {
        nome: 'GET /recorrencias como B não lista a de A',
        requisicao: () => ({ method: 'GET', url: '/api/v1/recorrencias' }),
        status: [200],
        naoDeveConter: (ids) => [ids.recorrenciaId!],
      },
    ],
  },
];
