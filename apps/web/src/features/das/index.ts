// Feature "das" (WP4 — Obrigações): DAS mensal, DASN-SIMEI, limite anual e alertas.
// `LimiteCard` e `AlertasList` são reexportados aqui porque o dashboard (WP5) os reutiliza
// (import { LimiteCard, AlertasList } from '@/features/das').
import { Landmark } from 'lucide-react';

import type { AppModule } from '@/app/registry';

export { LimiteCard, type LimiteCardProps, explicacaoNivel } from './components/limite-card';
export { AlertasList, type AlertasListProps, AlertaItem } from './components/alertas-list';

export const dasModule: AppModule = {
  id: 'das',
  routes: [
    {
      path: '/das',
      lazy: async () => ({ Component: (await import('./pages/das-page')).DasPage }),
    },
  ],
  nav: [
    {
      id: 'das',
      label: 'DAS',
      to: '/das',
      icon: Landmark,
      ordem: 40,
      mobile: true,
    },
  ],
};
