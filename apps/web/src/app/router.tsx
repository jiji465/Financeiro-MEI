// Router (React Router 7, data mode).
// - Páginas públicas (feature auth) dentro de AuthLayout + RedirectIfAuth.
// - Todas as outras features dentro de RequireAuth + AppShell, montadas a partir do registry.
// - "/" usa o placeholder de app/ até a feature dashboard registrar uma rota index.
import { createBrowserRouter, type RouteObject } from 'react-router';

import { InicioPlaceholder } from '@/app/inicio-placeholder';
import { NaoEncontrada } from '@/app/nao-encontrada';
import { modules } from '@/app/registry';
import { RotaErro } from '@/app/rota-erro';
import { AppShell } from '@/components/layout/app-shell';
import { AuthLayout } from '@/components/layout/auth-layout';
import { PageSkeleton } from '@/components/ui/skeleton';
import { RedirectIfAuth } from '@/features/auth/redirect-if-auth';
import { RequireAuth } from '@/features/auth/require-auth';

const rotasPublicas: RouteObject[] = modules
  .filter((m) => m.id === 'auth')
  .flatMap((m) => m.routes);
const rotasApp: RouteObject[] = modules.filter((m) => m.id !== 'auth').flatMap((m) => m.routes);

const temInicio = rotasApp.some((r) => r.index === true || r.path === '/' || r.path === '');

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
        <RequireAuth>
          <AppShell />
        </RequireAuth>
      ),
      errorElement: <RotaErro />,
      hydrateFallbackElement: <PageSkeleton />,
      children: [
        ...(temInicio
          ? []
          : [{ index: true, element: <InicioPlaceholder /> } satisfies RouteObject]),
        ...rotasApp,
        { path: '*', element: <NaoEncontrada /> },
      ],
    },
  ];
}

export const router = createBrowserRouter(criarRotas());
