// Isolamento: notas fiscais (WP3). B não enxerga/altera notas de A nem vincula lançamentos de A.
import type { RecursoIsolamento } from './_registry.js';

interface Cat {
  id: string;
  tipo: 'receita' | 'despesa';
}

const URL = '/api/v1/notas-fiscais';

export const recursos: RecursoIsolamento[] = [
  {
    recurso: 'notas-fiscais',
    rotasCobertas: [
      `GET ${URL}/:id`,
      `PATCH ${URL}/:id`,
      `DELETE ${URL}/:id`,
      `POST ${URL}/:id/cancelar`,
      `POST ${URL}/:id/vincular`,
      `POST ${URL}/:id/arquivo`,
      `GET ${URL}/:id/arquivo`,
      `DELETE ${URL}/:id/arquivo`,
    ],
    async preparar(app, a) {
      const cats = await app.inject({
        method: 'GET',
        url: '/api/v1/categorias',
        headers: a.headers,
      });
      const receita = cats.json<{ data: Cat[] }>().data.find((c) => c.tipo === 'receita')!;
      const res = await app.inject({
        method: 'POST',
        url: URL,
        headers: a.headers,
        payload: {
          tipo: 'nfse',
          numero: '77',
          dataEmissao: '2026-02-10',
          valor: 5_000,
          descricao: 'Nota secreta de A',
          gerarReceita: true,
          categoriaId: receita.id,
        },
      });
      if (res.statusCode !== 201) throw new Error(`preparar notas: ${res.body}`);
      const { nota, lancamento } = res.json<{
        data: { nota: { id: string }; lancamento: { id: string } };
      }>().data;
      const form = new FormData();
      form.append('arquivo', new Blob(['%PDF-1.4'], { type: 'application/pdf' }), 'nota.pdf');
      const upload = await app.inject({
        method: 'POST',
        url: `${URL}/${nota.id}/arquivo`,
        headers: a.headers,
        payload: form,
      });
      if (upload.statusCode !== 200) throw new Error(`preparar arquivo: ${upload.body}`);
      return { notaId: nota.id, lancamentoReceitaA: lancamento.id, categoriaReceitaA: receita.id };
    },
    casos: [
      {
        nome: 'GET /notas-fiscais/:id de A como B → 404',
        requisicao: (ids) => ({ method: 'GET', url: `${URL}/${ids.notaId}` }),
      },
      {
        nome: 'PATCH /notas-fiscais/:id de A como B → 404',
        requisicao: (ids) => ({
          method: 'PATCH',
          url: `${URL}/${ids.notaId}`,
          payload: { descricao: 'Invadida' },
        }),
      },
      {
        nome: 'DELETE /notas-fiscais/:id de A como B → 404',
        requisicao: (ids) => ({ method: 'DELETE', url: `${URL}/${ids.notaId}` }),
      },
      {
        nome: 'POST /notas-fiscais/:id/cancelar de A como B → 404',
        requisicao: (ids) => ({
          method: 'POST',
          url: `${URL}/${ids.notaId}/cancelar`,
          payload: { motivoCancelamento: 'Tentativa de B' },
        }),
      },
      {
        nome: 'POST /notas-fiscais/:id/vincular de A como B → 404',
        requisicao: (ids) => ({
          method: 'POST',
          url: `${URL}/${ids.notaId}/vincular`,
          payload: { lancamentoId: null },
        }),
      },
      {
        nome: 'GET /notas-fiscais/:id/arquivo de A como B → 404',
        requisicao: (ids) => ({ method: 'GET', url: `${URL}/${ids.notaId}/arquivo` }),
      },
      {
        nome: 'DELETE /notas-fiscais/:id/arquivo de A como B → 404',
        requisicao: (ids) => ({ method: 'DELETE', url: `${URL}/${ids.notaId}/arquivo` }),
      },
      {
        nome: 'POST /notas-fiscais/:id/arquivo de A como B → 404',
        requisicao: (ids) => {
          const form = new FormData();
          form.append('arquivo', new Blob(['%PDF-1.4'], { type: 'application/pdf' }), 'b.pdf');
          return { method: 'POST', url: `${URL}/${ids.notaId}/arquivo`, payload: form };
        },
      },
      {
        nome: 'POST /notas-fiscais como B vinculando lançamento de A → 404',
        requisicao: (ids) => ({
          method: 'POST',
          url: URL,
          payload: {
            tipo: 'nfse',
            numero: '78',
            dataEmissao: '2026-02-11',
            valor: 100,
            lancamentoId: ids.lancamentoReceitaA,
          },
        }),
      },
      {
        nome: 'POST /notas-fiscais como B gerando receita na categoria de A → 404',
        requisicao: (ids) => ({
          method: 'POST',
          url: URL,
          payload: {
            tipo: 'nfse',
            numero: '79',
            dataEmissao: '2026-02-11',
            valor: 100,
            gerarReceita: true,
            categoriaId: ids.categoriaReceitaA,
          },
        }),
      },
      {
        nome: 'GET /notas-fiscais como B não lista a nota de A',
        requisicao: () => ({ method: 'GET', url: URL }),
        status: [200],
        naoDeveConter: (ids) => [ids.notaId!, ids.lancamentoReceitaA!],
      },
    ],
  },
];
