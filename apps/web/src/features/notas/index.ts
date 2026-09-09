// Feature "notas" (WP3): registro manual de notas fiscais (NF-e/NFS-e/NFC-e), com geração
// opcional da receita correspondente. Página carregada sob demanda (lazy).
import { Receipt } from 'lucide-react';

import type { AppModule } from '@/app/registry';

export const notasModule: AppModule = {
  id: 'notas',
  routes: [
    {
      path: '/notas-fiscais',
      lazy: async () => ({ Component: (await import('./pages/lista-page')).NotasListaPage }),
    },
  ],
  nav: [
    {
      id: 'notas',
      label: 'Notas fiscais',
      to: '/notas-fiscais',
      icon: Receipt,
      ordem: 50,
      mobile: false,
    },
  ],
};

export { notasKeys } from './keys';
export {
  useAtualizarNota,
  useCancelarNota,
  useCriarNota,
  useEnviarArquivoNota,
  useExcluirNota,
  useNota,
  useNotas,
  useRemoverArquivoNota,
  useResumoNotas,
  useVincularNota,
} from './hooks';
