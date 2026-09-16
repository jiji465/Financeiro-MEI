// Feature "dashboard" (WP5): página inicial (rota index) com cards, gráficos, limite anual,
// alertas, próximos vencimentos, saldos das contas e atalhos.
//
// O item de navegação vive AQUI, e não mais como uma constante solta em components/layout/nav.ts:
// "Início" não dizia o que a tela mostra, e a navegação inteira passa a ter uma origem só — o
// registry —, em vez de um item sintético injetado à parte.
import { LayoutDashboard } from 'lucide-react';

import type { AppModule } from '@/app/registry';

export const dashboardModule: AppModule = {
  id: 'dashboard',
  routes: [
    {
      index: true,
      lazy: async () => ({ Component: (await import('./pages/dashboard-page')).DashboardPage }),
    },
  ],
  nav: [
    {
      id: 'visao-geral',
      label: 'Visão geral',
      to: '/',
      icon: LayoutDashboard,
      ordem: 0,
      mobile: true,
    },
  ],
};
