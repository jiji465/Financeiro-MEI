// Isolamento: obrigações (WP4). DAS pago, DASN e alerta dispensado de A nunca aparecem para B.
// O runner cria A e B como comercio_servicos sem data de abertura (jan/2026 sempre devida).
import type { RecursoIsolamento } from './_registry.js';

const BASE = '/api/v1/obrigacoes';
const COMPETENCIA = '2026-01';
const CHAVE = 'cadastro:data_abertura_ausente';

export const recursos: RecursoIsolamento[] = [
  {
    recurso: 'obrigacoes',
    rotasCobertas: [
      `GET ${BASE}/das/:competencia`,
      `POST ${BASE}/das/:competencia/pagamento`,
      `DELETE ${BASE}/das/:competencia/pagamento`,
      `PUT ${BASE}/dasn/:anoBase`,
      `POST ${BASE}/alertas/:chave/dispensar`,
      `DELETE ${BASE}/alertas/:chave/dispensar`,
    ],
    async preparar(app, a) {
      const pagamento = await app.inject({
        method: 'POST',
        url: `${BASE}/das/${COMPETENCIA}/pagamento`,
        headers: a.headers,
        payload: { observacao: 'DAS secreto de A' },
      });
      if (pagamento.statusCode !== 201) throw new Error(`preparar obrigacoes: ${pagamento.body}`);
      const corpo = pagamento.json<{
        data: { competencia: { pagamento: { id: string } }; lancamento: { id: string } };
      }>();

      const dasn = await app.inject({
        method: 'PUT',
        url: `${BASE}/dasn/2025`,
        headers: a.headers,
        payload: { status: 'entregue', dataEntrega: '2026-05-10', numeroRecibo: 'RECIBO-DE-A' },
      });
      if (dasn.statusCode !== 200) throw new Error(`preparar dasn: ${dasn.body}`);

      const dispensa = await app.inject({
        method: 'POST',
        url: `${BASE}/alertas/${CHAVE}/dispensar`,
        headers: a.headers,
        payload: {},
      });
      if (dispensa.statusCode !== 200) throw new Error(`preparar alerta: ${dispensa.body}`);

      return {
        pagamentoId: corpo.data.competencia.pagamento.id,
        lancamentoId: corpo.data.lancamento.id,
        tenantIdA: a.tenantId,
      };
    },
    casos: [
      {
        nome: 'GET /das/:competencia como B não mostra o pagamento de A',
        requisicao: () => ({ method: 'GET', url: `${BASE}/das/${COMPETENCIA}` }),
        status: [200],
        naoDeveConter: (ids) => [ids.pagamentoId!, ids.lancamentoId!],
      },
      {
        nome: 'GET /das?ano como B não lista o pagamento de A',
        requisicao: () => ({ method: 'GET', url: `${BASE}/das?ano=2026` }),
        status: [200],
        naoDeveConter: (ids) => [ids.pagamentoId!, ids.lancamentoId!, ids.tenantIdA!],
      },
      {
        nome: 'DELETE /das/:competencia/pagamento de A como B → 404',
        requisicao: () => ({ method: 'DELETE', url: `${BASE}/das/${COMPETENCIA}/pagamento` }),
      },
      {
        nome: 'POST /das/:competencia/pagamento como B cria só no tenant B',
        requisicao: () => ({
          method: 'POST',
          url: `${BASE}/das/${COMPETENCIA}/pagamento`,
          payload: {},
        }),
        status: [201],
        naoDeveConter: (ids) => [ids.pagamentoId!, ids.lancamentoId!, ids.tenantIdA!],
      },
      {
        nome: 'GET /dasn?ano como B não vê a declaração de A',
        requisicao: () => ({ method: 'GET', url: `${BASE}/dasn?ano=2025` }),
        status: [200],
        naoDeveConter: (ids) => ['RECIBO-DE-A', ids.tenantIdA!],
      },
      {
        nome: 'PUT /dasn/:anoBase como B grava só no tenant B',
        requisicao: () => ({
          method: 'PUT',
          url: `${BASE}/dasn/2025`,
          payload: { status: 'pendente' },
        }),
        status: [200],
        naoDeveConter: (ids) => ['RECIBO-DE-A', ids.tenantIdA!],
      },
      {
        nome: 'DELETE /alertas/:chave/dispensar como B (A dispensou) → 404',
        requisicao: () => ({ method: 'DELETE', url: `${BASE}/alertas/${CHAVE}/dispensar` }),
      },
      {
        nome: 'GET /alertas como B ainda mostra o alerta que só A dispensou',
        requisicao: () => ({ method: 'GET', url: `${BASE}/alertas` }),
        status: [200],
        naoDeveConter: (ids) => [ids.tenantIdA!, ids.pagamentoId!],
      },
      {
        nome: 'POST /alertas/:chave/dispensar como B dispensa só para B',
        requisicao: () => ({
          method: 'POST',
          url: `${BASE}/alertas/${CHAVE}/dispensar`,
          payload: {},
        }),
        status: [200],
        naoDeveConter: (ids) => [ids.tenantIdA!],
      },
    ],
  },
];
