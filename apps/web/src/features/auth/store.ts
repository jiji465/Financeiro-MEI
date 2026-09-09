// Sessão em memória (zustand). O access token nunca vai para localStorage: em recarga de página,
// RequireAuth tenta um refresh via cookie httpOnly (POST /auth/refresh) e recompõe a sessão.
import type { AuthTenant, AuthUser } from '@meifin/shared';
import { create } from 'zustand';

export interface Sessao {
  accessToken: string;
  user: AuthUser;
  tenant: AuthTenant;
}

export interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  tenant: AuthTenant | null;
  /** true depois da primeira tentativa de restaurar a sessão (ou de um login). */
  bootstrapped: boolean;
  setSession: (sessao: Sessao) => void;
  setAccessToken: (token: string) => void;
  setUsuario: (dados: { user: AuthUser; tenant: AuthTenant }) => void;
  setBootstrapped: () => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  user: null,
  tenant: null,
  bootstrapped: false,
  setSession: ({ accessToken, user, tenant }) =>
    set({ accessToken, user, tenant, bootstrapped: true }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setUsuario: ({ user, tenant }) => set({ user, tenant }),
  setBootstrapped: () => set({ bootstrapped: true }),
  clear: () => set({ accessToken: null, user: null, tenant: null, bootstrapped: true }),
}));

/** Acesso fora de componentes (cliente da API, testes). */
export const authStore = useAuthStore;
