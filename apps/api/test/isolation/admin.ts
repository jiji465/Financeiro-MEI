// Rotas /admin/* não são "por tenant" — são bloqueadas para QUALQUER usuário sem admin=true,
// inclusive o próprio dono de um tenant válido (tenant B aqui não é admin). Por isso os casos
// esperam 403 (requireAdmin), não 404: a garantia é "sem admin, acesso nenhum a estes dados",
// que é a mesma preocupação de isolamento levada ao extremo.
import type { RecursoIsolamento } from './_registry.js';

export const recursos: RecursoIsolamento[] = [
  {
    recurso: 'admin',
    rotasCobertas: [
      'GET /api/v1/admin/tenants/:id',
      'PATCH /api/v1/admin/tenants/:id',
      'PATCH /api/v1/admin/usuarios/:id',
      'POST /api/v1/admin/usuarios/:id/redefinir-senha',
      'PATCH /api/v1/admin/solicitacoes/:id',
    ],
    async preparar(_app, a) {
      return { tenantId: a.tenantId, userId: a.userId };
    },
    casos: [
      {
        nome: 'GET /admin/tenants/:id sem ser admin → 403',
        requisicao: (ids) => ({ method: 'GET', url: `/api/v1/admin/tenants/${ids.tenantId}` }),
        status: [403],
      },
      {
        nome: 'PATCH /admin/tenants/:id sem ser admin → 403',
        requisicao: (ids) => ({
          method: 'PATCH',
          url: `/api/v1/admin/tenants/${ids.tenantId}`,
          payload: { ativo: false },
        }),
        status: [403],
      },
      {
        nome: 'PATCH /admin/usuarios/:id sem ser admin → 403',
        requisicao: (ids) => ({
          method: 'PATCH',
          url: `/api/v1/admin/usuarios/${ids.userId}`,
          payload: { ativo: false },
        }),
        status: [403],
      },
      {
        nome: 'POST /admin/usuarios/:id/redefinir-senha sem ser admin → 403',
        requisicao: (ids) => ({
          method: 'POST',
          url: `/api/v1/admin/usuarios/${ids.userId}/redefinir-senha`,
        }),
        status: [403],
      },
      {
        nome: 'PATCH /admin/solicitacoes/:id sem ser admin → 403',
        requisicao: () => ({
          method: 'PATCH',
          url: `/api/v1/admin/solicitacoes/00000000-0000-0000-0000-000000000000`,
          payload: { status: 'recusada' },
        }),
        status: [403],
      },
    ],
  },
];
