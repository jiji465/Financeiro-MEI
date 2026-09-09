// renderWithProviders: React Query + Tooltip + Confirm + Router (memory) para testes de UI.
//   const { user } = renderWithProviders(<LoginPage />, { route: '/entrar' });
//   await user.type(screen.getByLabelText('E-mail'), 'a@b.com');
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement, ReactNode } from 'react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';

import { ConfirmProvider } from '@/components/ui/confirm-dialog';
import { TooltipProvider } from '@/components/ui/tooltip';

export function criarTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Rota inicial (padrão "/"). */
  route?: string;
  /** Rotas completas; se omitido, `ui` responde por qualquer caminho. */
  routes?: RouteObject[];
  queryClient?: QueryClient;
}

export function Providers({ client, children }: { client: QueryClient; children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider delayDuration={0}>
        <ConfirmProvider>{children}</ConfirmProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export function renderWithProviders(ui: ReactElement, options: RenderWithProvidersOptions = {}) {
  const { route = '/', routes, queryClient = criarTestQueryClient(), ...renderOptions } = options;
  const router = createMemoryRouter(routes ?? [{ path: '*', element: ui }], {
    initialEntries: [route],
  });
  const user = userEvent.setup();
  const result = render(
    <Providers client={queryClient}>
      <RouterProvider router={router} />
    </Providers>,
    renderOptions,
  );
  return { ...result, router, queryClient, user };
}

/** Render sem router (componentes puros que precisam só de React Query/Tooltip). */
export function renderComProviders(ui: ReactElement, options: Omit<RenderOptions, 'wrapper'> = {}) {
  const client = criarTestQueryClient();
  const user = userEvent.setup();
  const result = render(<Providers client={client}>{ui}</Providers>, options);
  return { ...result, queryClient: client, user };
}

export * from '@testing-library/react';
export { userEvent };
