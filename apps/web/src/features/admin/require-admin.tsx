// Protege as páginas do painel de administrador. RequireAuth (no shell) já garante sessão válida;
// aqui só falta checar o flag admin — quem não é admin nunca deveria ter chegado pelo menu, mas
// alguém pode digitar a URL direto.
import type { ReactNode } from 'react';
import { Navigate } from 'react-router';

import { useAuthStore } from '@/features/auth/store';

export function RequireAdmin({ children }: { children: ReactNode }) {
  const admin = useAuthStore((s) => s.user?.admin);
  if (!admin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
