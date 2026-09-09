// Feature "relatorios" (WP5): hub + DRE, extrato, faturamento x limite e DASN, com exportação
// CSV/PDF. A rota /relatorios/importar aponta para features/relatorios/importar (WP2), que este
// WP não edita — só registra o caminho aqui, como o próprio módulo de lançamentos já faz.
import { FileBarChart } from 'lucide-react';

import type { AppModule } from '@/app/registry';

export const relatoriosModule: AppModule = {
  id: 'relatorios',
  routes: [
    {
      path: '/relatorios',
      lazy: async () => ({ Component: (await import('./pages/hub-page')).RelatoriosHubPage }),
    },
    {
      path: '/relatorios/dre',
      lazy: async () => ({ Component: (await import('./pages/dre-page')).DrePage }),
    },
    {
      path: '/relatorios/extrato',
      lazy: async () => ({ Component: (await import('./pages/extrato-page')).ExtratoPage }),
    },
    {
      path: '/relatorios/faturamento',
      lazy: async () => ({
        Component: (await import('./pages/faturamento-page')).FaturamentoPage,
      }),
    },
    {
      path: '/relatorios/dasn',
      lazy: async () => ({ Component: (await import('./pages/dasn-page')).DasnPage }),
    },
  ],
  nav: [
    {
      id: 'relatorios',
      label: 'Relatórios',
      to: '/relatorios',
      icon: FileBarChart,
      ordem: 50,
      mobile: false,
    },
  ],
};
