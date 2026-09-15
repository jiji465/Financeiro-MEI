// Restauração da sessão em recarga de página: POST /auth/refresh (cookie) → GET /auth/me.
// Single-flight: RequireAuth e RedirectIfAuth podem chamar ao mesmo tempo.
import { queryClient } from '@/app/query-client';
import { refreshAccessToken } from '@/lib/api/client';

import { authApi } from './api';
import { authKeys } from './keys';
import { useAuthStore } from './store';

let restauracao: Promise<boolean> | null = null;

/** Tenta recompor a sessão. Resolve true se autenticado; sempre marca `bootstrapped`. */
export function restaurarSessao(): Promise<boolean> {
  const estado = useAuthStore.getState();
  if (estado.accessToken && estado.user) {
    if (!estado.bootstrapped) estado.setBootstrapped();
    return Promise.resolve(true);
  }
  if (!restauracao) {
    restauracao = (async () => {
      try {
        const token = await refreshAccessToken();
        if (!token) {
          useAuthStore.getState().clear();
          return false;
        }
        // Busca pelo cache do React Query, não direto pela api: `refreshAccessToken` já gravou o
        // token, então o RequireAuth renderiza o app e o `useMe()` monta enquanto esta chamada
        // ainda está no ar. Usando a mesma chave, os dois compartilham a requisição em voo em vez
        // de pedir /auth/me duas vezes — uma ida e volta inteira a menos em toda recarga.
        const data = await queryClient.fetchQuery({
          queryKey: authKeys.me(),
          queryFn: async () => (await authApi.me()).data,
        });
        useAuthStore
          .getState()
          .setSession({ accessToken: token, user: data.user, tenant: data.tenant });
        return true;
      } catch {
        useAuthStore.getState().clear();
        return false;
      } finally {
        restauracao = null;
      }
    })();
  }
  return restauracao;
}

/** Só caminhos relativos do próprio app (evita open redirect via ?next=). */
export function destinoSeguro(next: string | null | undefined, padrao = '/'): string {
  if (!next) return padrao;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return padrao;
  return next;
}
