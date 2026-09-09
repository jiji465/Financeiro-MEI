// Isolamento: importações CSV (WP2).
import type { RecursoIsolamento } from './_registry.js';

export const recursos: RecursoIsolamento[] = [
  {
    recurso: 'importacoes',
    rotasCobertas: ['GET /api/v1/importacoes/:id', 'DELETE /api/v1/importacoes/:id'],
    async preparar(app, a) {
      const cats = await app.inject({
        method: 'GET',
        url: '/api/v1/categorias?tipo=despesa',
        headers: a.headers,
      });
      const categoriaId = cats.json<{ data: { id: string }[] }>().data[0]?.id;
      if (!categoriaId) throw new Error('preparar importacoes: tenant A sem categorias');
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/importacoes/csv/confirmar',
        headers: a.headers,
        payload: {
          nomeArquivo: 'secreto-de-a.csv',
          totalLinhas: 1,
          mapeamento: { data: 'Data', valor: 'Valor', descricao: 'Descrição' },
          linhas: [
            {
              numero: 1,
              data: '2026-09-01',
              valor: 777,
              descricao: 'Importado secreto de A',
              tipo: 'despesa',
              categoriaId,
              hash: 'a'.repeat(64),
            },
          ],
        },
      });
      if (res.statusCode !== 201) throw new Error(`preparar importacoes: ${res.body}`);
      return { importacaoId: res.json<{ data: { id: string } }>().data.id };
    },
    casos: [
      {
        nome: 'GET /importacoes/:id de A como B → 404',
        requisicao: (ids) => ({ method: 'GET', url: `/api/v1/importacoes/${ids.importacaoId}` }),
      },
      {
        nome: 'DELETE /importacoes/:id de A como B → 404',
        requisicao: (ids) => ({
          method: 'DELETE',
          url: `/api/v1/importacoes/${ids.importacaoId}`,
        }),
      },
      {
        nome: 'GET /importacoes como B não lista a importação de A',
        requisicao: () => ({ method: 'GET', url: '/api/v1/importacoes' }),
        status: [200],
        naoDeveConter: (ids) => [ids.importacaoId!, 'secreto-de-a.csv'],
      },
    ],
  },
];
