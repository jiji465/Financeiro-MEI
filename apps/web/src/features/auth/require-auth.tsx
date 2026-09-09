// Protege o shell autenticado. Sem token em memória (recarga), tenta um refresh via cookie;
// enquanto isso mostra skeleton de página inteira. Sem sessão → /entrar?next=<rota atual>.
import { type ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router';

import { PageSkeleton } from '@/components/ui/skeleton';

import { restaurarSessao } from './session';
import { useAuthStore } from './store';

export interface RequireAuthProps {
  children: ReactNode;
  /**
   * Mostrado em vez de redirecionar para /entrar quando o visitante não está logado e a rota é
   * exatamente "/" (página de vendas pública). Todas as outras rotas continuam exigindo login.
   */
  fallbackPublico?: ReactNode;
}

export function RequireAuth({ children, fallbackPublico }: RequireAuthProps) {
  const token = useAuthStore((s) => s.accessToken);
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const location = useLocation();

  useEffect(() => {
    if (!token && !bootstrapped) void restaurarSessao();
  }, [token, bootstrapped]);

  if (token) return <>{children}</>;
  if (!bootstrapped) return <PageSkeleton />;

  if (fallbackPublico && location.pathname === '/') return <>{fallbackPublico}</>;

  const next = `${location.pathname}${location.search}`;
  const destino = next === '/' ? '/entrar' : `/entrar?next=${encodeURIComponent(next)}`;
  return <Navigate to={destino} replace />;
}
