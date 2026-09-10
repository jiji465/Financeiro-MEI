// Query keys da feature admin. Convenção: [feature, recurso, ...parâmetros].
import type { ListarSolicitacoesParams, ListarTenantsParams } from './api';

export const adminKeys = {
  all: ['admin'] as const,
  resumo: () => ['admin', 'resumo'] as const,
  tenants: (params: ListarTenantsParams) => ['admin', 'tenants', params] as const,
  tenant: (id: string) => ['admin', 'tenants', id] as const,
  solicitacoes: (params: ListarSolicitacoesParams) => ['admin', 'solicitacoes', params] as const,
};
