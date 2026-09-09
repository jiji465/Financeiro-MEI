// Restauração da sessão em recarga de página: POST /auth/refresh (cookie) → GET /auth/me.
// Single-flight: RequireAuth e RedirectIfAuth podem chamar ao mesmo tempo.
import { refreshAccessToken } from '@/lib/api/client';

import { authApi } from './api';
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
        const { data } = await authApi.me();
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
