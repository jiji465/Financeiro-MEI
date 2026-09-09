// Chamadas HTTP do painel de administrador (contratos em @meifin/shared/schemas/admin).
import type {
  AdminTenantDto,
  AtualizarSolicitacaoBody,
  AtualizarTenantBody,
  AtualizarUsuarioAdminBody,
  CriarContaAdminBody,
  ListaAdminTenantsResponse,
  ListaSolicitacoesResponse,
  ResumoPlataformaResponse,
  SolicitacaoDto,
  StatusSolicitacao,
} from '@meifin/shared';

import { api } from '@/lib/api/client';

export interface ListarTenantsParams {
  busca?: string;
  ativo?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ListarSolicitacoesParams {
  status?: StatusSolicitacao;
  page?: number;
  pageSize?: number;
}

export const adminApi = {
  resumo: () => api.get<ResumoPlataformaResponse>('/admin/resumo'),
  listarTenants: (params: ListarTenantsParams = {}) =>
    api.get<ListaAdminTenantsResponse>('/admin/tenants', { query: { ...params } }),
  atualizarTenant: (id: string, body: AtualizarTenantBody) =>
    api.patch<{ data: AdminTenantDto }>(`/admin/tenants/${id}`, body),
  atualizarUsuario: (id: string, body: AtualizarUsuarioAdminBody) =>
    api.patch<{ data: { id: string; admin: boolean; ativo: boolean } }>(
      `/admin/usuarios/${id}`,
      body,
    ),
  listarSolicitacoes: (params: ListarSolicitacoesParams = {}) =>
    api.get<ListaSolicitacoesResponse>('/admin/solicitacoes', { query: { ...params } }),
  atualizarSolicitacao: (id: string, body: AtualizarSolicitacaoBody) =>
    api.patch<{ data: SolicitacaoDto }>(`/admin/solicitacoes/${id}`, body),
  criarConta: (body: CriarContaAdminBody) =>
    api.post<{ data: { user: { email: string } } }>('/admin/contas', body),
};
