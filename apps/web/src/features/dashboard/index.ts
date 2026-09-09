// Feature "dashboard" (WP5): página inicial (rota index) com cards, gráficos, limite anual,
// alertas, próximos vencimentos e atalhos. Sem item de navegação: a sidebar/bottom nav já
// levam à raiz "/" por padrão (logo, ícone da marca).
import type { AppModule } from '@/app/registry';

export const dashboardModule: AppModule = {
  id: 'dashboard',
  routes: [
    {
      index: true,
      lazy: async () => ({ Component: (await import('./pages/dashboard-page')).DashboardPage }),
    },
  ],
  nav: [],
};
