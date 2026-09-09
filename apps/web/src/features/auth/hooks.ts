// Hooks de autenticação (mutations/queries) — as telas tratam erros inline (meta.silent).
import type { AuthResponse } from '@meifin/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';

import { authApi } from './api';
import { authKeys } from './keys';
import { destinoSeguro } from './session';
import { useAuthStore } from './store';

function useEntrarComSessao() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  return (resposta: AuthResponse) => {
    setSession({ accessToken: resposta.accessToken, user: resposta.user, tenant: resposta.tenant });
    navigate(destinoSeguro(params.get('next')), { replace: true });
  };
}

export function useLogin() {
  const entrar = useEntrarComSessao();
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: entrar,
    meta: { silent: true },
  });
}

/** Cadastro deixou de ser self-service: só registra o pedido, sem logar automaticamente. */
export function useSolicitarAcesso() {
  return useMutation({
    mutationFn: authApi.solicitarAcesso,
    meta: { silent: true },
  });
}

export function useLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const clear = useAuthStore((s) => s.clear);
  return useMutation({
    mutationFn: async () => {
      try {
        await authApi.logout();
      } catch {
        // mesmo se o servidor falhar, encerramos a sessão local
      }
    },
    onSettled: () => {
      clear();
      queryClient.clear();
      navigate('/entrar', { replace: true });
    },
    meta: { silent: true },
  });
}

/** Usuário e MEI atuais (GET /auth/me); mantém a store sincronizada. */
export function useMe() {
  const token = useAuthStore((s) => s.accessToken);
  const setUsuario = useAuthStore((s) => s.setUsuario);
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: async () => {
      const { data } = await authApi.me();
      setUsuario(data);
      return data;
    },
    enabled: Boolean(token),
    staleTime: 5 * 60_000,
  });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: authApi.forgotPassword, meta: { silent: true } });
}

export function useResetPassword() {
  return useMutation({ mutationFn: authApi.resetPassword, meta: { silent: true } });
}

export function useChangePassword() {
  return useMutation({ mutationFn: authApi.changePassword, meta: { silent: true } });
}
