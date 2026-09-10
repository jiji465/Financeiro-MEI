// Feature "admin" (seção 11 do plano): painel de administração da plataforma. Item de menu
// só aparece para quem tem admin=true (filtrarPorAdmin em components/layout/nav.ts).
import { ShieldCheck } from 'lucide-react';

import type { AppModule } from '@/app/registry';

export const adminModule: AppModule = {
  id: 'admin',
  routes: [
    {
      path: '/admin',
      lazy: async () => ({ Component: (await import('./pages/admin-page')).AdminPage }),
    },
    {
      path: '/admin/contas/:id',
      lazy: async () => ({
        Component: (await import('./pages/tenant-detalhe-page')).TenantDetalhePage,
      }),
    },
  ],
  nav: [
    {
      id: 'admin',
      label: 'Administração',
      to: '/admin',
      icon: ShieldCheck,
      ordem: 95,
      mobile: false,
      somenteAdmin: true,
    },
  ],
};
