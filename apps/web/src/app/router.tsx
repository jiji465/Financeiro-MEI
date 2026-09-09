// Router (React Router 7, data mode). P1-C (Web core) substitui a home placeholder pelo shell
// autenticado (RequireAuth + layout) e move as rotas públicas de auth para o auth-layout.
import { createBrowserRouter } from 'react-router';

import { HomePlaceholder, RotaErro } from '@/app/home-placeholder';
import { modules } from '@/app/registry';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePlaceholder />,
    errorElement: <RotaErro />,
  },
  ...modules.flatMap((m) => m.routes),
]);
