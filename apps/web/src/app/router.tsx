// Router (React Router 7, data mode).
// - Páginas públicas (feature auth) dentro de AuthLayout + RedirectIfAuth.
// - Todas as outras features dentro de RequireAuth + AppShell, montadas a partir do registry.
// - "/" é a "Visão geral" (features/dashboard registra a rota index).
import { lazy, Suspense } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';

import { NaoEncontrada } from '@/app/nao-encontrada';
import { modules } from '@/app/registry';
import { RotaErro } from '@/app/rota-erro';
import { AuthLayout } from '@/components/layout/auth-layout';
import { PageSkeleton } from '@/components/ui/skeleton';
import { RedirectIfAuth } from '@/features/auth/redirect-if-auth';
import { RequireAuth } from '@/features/auth/require-auth';
import { LandingPage } from '@/features/vendas/landing-page';

// O shell autenticado (sidebar, topbar, troca obrigatória de senha, tour) carrega sob demanda:
// ele arrasta junto formulários e validação que só fazem sentido depois do login, e quem chega
// na página de vendas pagava esse download sem nunca usar.
const AppShell = lazy(async () => ({
  default: (await import('@/components/layout/app-shell')).AppShell,
}));

const rotasPublicas: RouteObject[] = modules
  .filter((m) => m.id === 'auth')
  .flatMap((m) => m.routes);
const rotasApp: RouteObject[] = modules.filter((m) => m.id !== 'auth').flatMap((m) => m.routes);

export function criarRotas(): RouteObject[] {
  return [
    {
      element: (
        <RedirectIfAuth>
          <AuthLayout />
        </RedirectIfAuth>
      ),
      errorElement: <RotaErro />,
      hydrateFallbackElement: <PageSkeleton />,
      children: rotasPublicas,
    },
    {
      path: '/',
      element: (
        <RequireAuth fallbackPublico={<LandingPage />}>
          <Suspense fallback={<PageSkeleton />}>
            <AppShell />
          </Suspense>
        </RequireAuth>
      ),
      errorElement: <RotaErro />,
      hydrateFallbackElement: <PageSkeleton />,
      children: [...rotasApp, { path: '*', element: <NaoEncontrada /> }],
    },
  ];
}

export const router = createBrowserRouter(criarRotas());
