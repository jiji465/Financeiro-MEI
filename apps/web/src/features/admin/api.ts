// Chamadas HTTP do painel de administrador (contratos em @meifin/shared/schemas/admin).
import type {
  AdminTenantDto,
  AdminTenantResponse,
  AtualizarSolicitacaoBody,
  AtualizarTenantBody,
  AtualizarUsuarioAdminBody,
  CriarAdministradorBody,
  CriarContaAdminBody,
  ListaAdminTenantsResponse,
  ListaSolicitacoesResponse,
  RedefinirSenhaResponse,
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
  buscarTenant: (id: string) => api.get<AdminTenantResponse>(`/admin/tenants/${id}`),
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
  criarAdministrador: (body: CriarAdministradorBody) =>
    api.post<{ data: { user: { email: string } } }>('/admin/administradores', body),
  redefinirSenha: (id: string) =>
    api.post<RedefinirSenhaResponse>(`/admin/usuarios/${id}/redefinir-senha`),
};
