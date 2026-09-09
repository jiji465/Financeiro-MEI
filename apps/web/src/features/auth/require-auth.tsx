// Protege o shell autenticado. Sem token em memória (recarga), tenta um refresh via cookie;
// enquanto isso mostra skeleton de página inteira. Sem sessão → /entrar?next=<rota atual>.
import { type ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router';

import { PageSkeleton } from '@/components/ui/skeleton';

import { restaurarSessao } from './session';
import { useAuthStore } from './store';

export function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const location = useLocation();

  useEffect(() => {
    if (!token && !bootstrapped) void restaurarSessao();
  }, [token, bootstrapped]);

  if (token) return <>{children}</>;
  if (!bootstrapped) return <PageSkeleton />;

  const next = `${location.pathname}${location.search}`;
  const destino = next === '/' ? '/entrar' : `/entrar?next=${encodeURIComponent(next)}`;
  return <Navigate to={destino} replace />;
}
