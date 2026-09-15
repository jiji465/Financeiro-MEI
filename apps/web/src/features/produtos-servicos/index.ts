// Feature "produtos-servicos": o catálogo do MEI (o que ele vende e o que ele presta), usado
// pelos itens do lançamento. Página carregada sob demanda (lazy).
import { Package } from 'lucide-react';

import type { AppModule } from '@/app/registry';

export const produtosServicosModule: AppModule = {
  id: 'produtos-servicos',
  routes: [
    {
      path: '/produtos-servicos',
      lazy: async () => ({
        Component: (await import('./pages/lista-page')).ProdutosServicosListaPage,
      }),
    },
  ],
  nav: [
    {
      id: 'produtos-servicos',
      label: 'Produtos e serviços',
      to: '/produtos-servicos',
      icon: Package,
      ordem: 35,
      mobile: false,
    },
  ],
};

export { produtosServicosKeys } from './keys';
export {
  useAtualizarProdutoServico,
  useCriarProdutoServico,
  useExcluirProdutoServico,
  useProdutoServico,
  useProdutosServicos,
} from './hooks';
