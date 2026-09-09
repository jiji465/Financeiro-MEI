// Feature "configuracoes" (WP4 — Obrigações + Configurações): dados do MEI, categorias, preferências
// e conta. O menu do usuário (Topbar/Sidebar) mostra "Configurações" automaticamente por causa deste
// NavItem apontando para "/configuracoes".
import { Settings } from 'lucide-react';

import type { AppModule } from '@/app/registry';

export const configuracoesModule: AppModule = {
  id: 'configuracoes',
  routes: [
    {
      path: '/configuracoes',
      lazy: async () => ({
        Component: (await import('./pages/configuracoes-page')).ConfiguracoesPage,
      }),
    },
  ],
  nav: [
    {
      id: 'configuracoes',
      label: 'Configurações',
      to: '/configuracoes',
      icon: Settings,
      ordem: 90,
      mobile: false,
    },
  ],
};
