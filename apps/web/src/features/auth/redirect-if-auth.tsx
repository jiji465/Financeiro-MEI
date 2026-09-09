// Páginas públicas: usuário já autenticado (ou com cookie de refresh válido) vai para o app.
import { type ReactNode, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router';

import { PageSkeleton } from '@/components/ui/skeleton';

import { destinoSeguro, restaurarSessao } from './session';
import { useAuthStore } from './store';

export function RedirectIfAuth({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const [params] = useSearchParams();

  useEffect(() => {
    if (!token && !bootstrapped) void restaurarSessao();
  }, [token, bootstrapped]);

  if (token) return <Navigate to={destinoSeguro(params.get('next'))} replace />;
  if (!bootstrapped) return <PageSkeleton />;
  return <>{children}</>;
}
