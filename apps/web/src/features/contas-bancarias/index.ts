// Feature "contas-bancarias": cadastro manual das contas do MEI (banco, poupança, conta de
// pagamento ou dinheiro em espécie) com saldo por conta. Página carregada sob demanda (lazy).
import { Banknote } from 'lucide-react';

import type { AppModule } from '@/app/registry';

export const contasBancariasModule: AppModule = {
  id: 'contas-bancarias',
  routes: [
    {
      path: '/contas-bancarias',
      lazy: async () => ({
        Component: (await import('./pages/lista-page')).ContasBancariasListaPage,
      }),
    },
  ],
  nav: [
    {
      id: 'contas-bancarias',
      label: 'Contas bancárias',
      to: '/contas-bancarias',
      icon: Banknote,
      ordem: 30,
      mobile: false,
    },
  ],
};

export { contasBancariasKeys } from './keys';
export {
  useAtualizarContaBancaria,
  useContaBancaria,
  useContasBancarias,
  useCriarContaBancaria,
  useExcluirContaBancaria,
} from './hooks';
