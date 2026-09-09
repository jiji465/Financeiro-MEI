// Isolamento: dashboard (WP5). Nenhuma rota do módulo tem parâmetro (":id" etc.), então não há
// nada a listar em rotasCobertas — mas o runner ainda executa `preparar`/`casos`, então
// aproveitamos para confirmar que os agregados do tenant A não vazam para B.
import type { RecursoIsolamento } from './_registry.js';

const BASE = '/api/v1/dashboard';

export const recursos: RecursoIsolamento[] = [
  {
    recurso: 'dashboard',
    rotasCobertas: [],
    async preparar(app, a) {
      const categorias = await app.inject({
        method: 'GET',
        url: '/api/v1/categorias',
        headers: a.headers,
      });
      const receita = categorias
        .json<{ data: { id: string; tipo: string }[] }>()
        .data.find((c) => c.tipo === 'receita');
      if (!receita) throw new Error('preparar dashboard: nenhuma categoria de receita');

      const lancamento = await app.inject({
        method: 'POST',
        url: '/api/v1/lancamentos',
        headers: a.headers,
        payload: {
          tipo: 'receita',
          data: '2026-01-10',
          valor: 8_765_400,
          descricao: 'Receita secreta de A',
          categoriaId: receita.id,
          formaPagamento: 'pix',
          status: 'pago',
        },
      });
      if (lancamento.statusCode !== 201) {
        throw new Error(`preparar dashboard: ${lancamento.body}`);
      }
      return { lancamentoId: lancamento.json<{ data: { id: string } }>().data.id };
    },
    casos: [
      {
        nome: 'GET /resumo como B não soma a receita de A',
        requisicao: () => ({ method: 'GET', url: `${BASE}/resumo?de=2026-01-01&ate=2026-01-31` }),
        status: [200],
        naoDeveConter: () => ['8765400'],
      },
      {
        nome: 'GET /por-categoria como B não lista nada',
        requisicao: () => ({
          method: 'GET',
          url: `${BASE}/por-categoria?de=2026-01-01&ate=2026-01-31&tipo=receita`,
        }),
        status: [200],
        naoDeveConter: (ids) => [ids.lancamentoId!, '8765400'],
      },
      {
        nome: 'GET /comparativo-mensal como B não mostra o mês de A',
        requisicao: () => ({ method: 'GET', url: `${BASE}/comparativo-mensal?meses=1` }),
        status: [200],
        naoDeveConter: () => ['8765400'],
      },
    ],
  },
];
