// Hooks da feature admin (queries + mutations). Mutações invalidam ['admin'] inteiro — painel de
// baixo tráfego, não precisa de invalidação fina.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi, type ListarSolicitacoesParams, type ListarTenantsParams } from './api';
import { adminKeys } from './keys';

export function useResumoPlataforma() {
  return useQuery({
    queryKey: adminKeys.resumo(),
    queryFn: () => adminApi.resumo(),
    select: (res) => res.data,
  });
}

export function useAdminTenants(params: ListarTenantsParams = {}) {
  return useQuery({
    queryKey: adminKeys.tenants({ ...params }),
    queryFn: () => adminApi.listarTenants(params),
    placeholderData: keepPreviousData,
  });
}

export function useAdminSolicitacoes(params: ListarSolicitacoesParams = {}) {
  return useQuery({
    queryKey: adminKeys.solicitacoes({ ...params }),
    queryFn: () => adminApi.listarSolicitacoes(params),
    placeholderData: keepPreviousData,
  });
}

function useInvalidarAdmin() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: adminKeys.all });
}

export function useAtualizarTenant() {
  const invalidar = useInvalidarAdmin();
  return useMutation({
    mutationFn: (vars: { id: string; ativo: boolean }) =>
      adminApi.atualizarTenant(vars.id, { ativo: vars.ativo }),
    onSuccess: () => invalidar(),
    meta: { sucesso: 'Conta atualizada' },
  });
}

export function useAtualizarUsuarioAdmin() {
  const invalidar = useInvalidarAdmin();
  return useMutation({
    mutationFn: (vars: { id: string; ativo?: boolean; admin?: boolean }) =>
      adminApi.atualizarUsuario(vars.id, { ativo: vars.ativo, admin: vars.admin }),
    onSuccess: () => invalidar(),
    meta: { sucesso: 'Usuário atualizado' },
  });
}

export function useAtualizarSolicitacao() {
  const invalidar = useInvalidarAdmin();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      status: 'aprovada' | 'recusada';
      observacaoAdmin?: string | undefined;
    }) =>
      adminApi.atualizarSolicitacao(vars.id, {
        status: vars.status,
        observacaoAdmin: vars.observacaoAdmin,
      }),
    onSuccess: () => invalidar(),
    meta: { sucesso: 'Pedido atualizado' },
  });
}

export function useCriarContaAdmin() {
  const invalidar = useInvalidarAdmin();
  return useMutation({
    mutationFn: adminApi.criarConta,
    onSuccess: () => invalidar(),
    meta: { silent: true, sucesso: 'Conta criada' },
  });
}
