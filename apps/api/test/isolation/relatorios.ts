// Isolamento: relatórios (WP5). Nenhuma rota do módulo tem parâmetro (":id" etc.), então não há
// nada a listar em rotasCobertas — mas confirmamos que o extrato e a exportação de lançamentos
// de B não trazem nada do tenant A.
import type { RecursoIsolamento } from './_registry.js';

const BASE = '/api/v1/relatorios';

export const recursos: RecursoIsolamento[] = [
  {
    recurso: 'relatorios',
    rotasCobertas: [],
    async preparar(app, a) {
      const categorias = await app.inject({
        method: 'GET',
        url: '/api/v1/categorias',
        headers: a.headers,
      });
      const despesa = categorias
        .json<{ data: { id: string; tipo: string; sistema: boolean }[] }>()
        .data.find((c) => c.tipo === 'despesa' && !c.sistema);
      if (!despesa) throw new Error('preparar relatorios: nenhuma categoria de despesa');

      const lancamento = await app.inject({
        method: 'POST',
        url: '/api/v1/lancamentos',
        headers: a.headers,
        payload: {
          tipo: 'despesa',
          data: '2026-02-10',
          valor: 5_432_100,
          descricao: 'Despesa secreta de A',
          categoriaId: despesa.id,
          formaPagamento: 'boleto',
          status: 'pago',
        },
      });
      if (lancamento.statusCode !== 201) {
        throw new Error(`preparar relatorios: ${lancamento.body}`);
      }
      return { lancamentoId: lancamento.json<{ data: { id: string } }>().data.id };
    },
    casos: [
      {
        nome: 'GET /extrato como B não mostra o lançamento de A',
        requisicao: () => ({
          method: 'GET',
          url: `${BASE}/extrato?de=2026-02-01&ate=2026-02-28`,
        }),
        status: [200],
        naoDeveConter: (ids) => [ids.lancamentoId!, 'Despesa secreta de A', '5432100'],
      },
      {
        nome: 'GET /lancamentos?formato=json como B não lista o lançamento de A',
        requisicao: () => ({
          method: 'GET',
          url: `${BASE}/lancamentos?de=2026-02-01&ate=2026-02-28&formato=json`,
        }),
        status: [200],
        naoDeveConter: (ids) => [ids.lancamentoId!, 'Despesa secreta de A'],
      },
      {
        nome: 'GET /dre como B não soma a despesa de A',
        requisicao: () => ({ method: 'GET', url: `${BASE}/dre?de=2026-02-01&ate=2026-02-28` }),
        status: [200],
        naoDeveConter: () => ['5432100'],
      },
    ],
  },
];
