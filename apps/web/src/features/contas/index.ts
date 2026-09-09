// Feature "contas" (WP3): contas a pagar/receber parceladas — grupos por vencimento, baixa
// rápida (cria lançamento) e estorno. Páginas carregadas sob demanda (lazy).
import { Wallet } from 'lucide-react';

import type { AppModule } from '@/app/registry';

export const contasModule: AppModule = {
  id: 'contas',
  routes: [
    {
      path: '/contas/pagar',
      lazy: async () => ({ Component: (await import('./pages/lista-page')).ContasPagarPage }),
    },
    {
      path: '/contas/receber',
      lazy: async () => ({ Component: (await import('./pages/lista-page')).ContasReceberPage }),
    },
  ],
  nav: [
    {
      id: 'contas',
      label: 'Contas',
      to: '/contas/pagar',
      icon: Wallet,
      ordem: 20,
      mobile: true,
    },
  ],
};

export { contasKeys } from './keys';
export {
  useAtualizarTitulo,
  useBaixarParcela,
  useCancelarTitulo,
  useCriarTitulo,
  useEstornarParcela,
  useParcela,
  useParcelas,
  useResumoParcelas,
  useTitulo,
  useTitulos,
} from './hooks';
