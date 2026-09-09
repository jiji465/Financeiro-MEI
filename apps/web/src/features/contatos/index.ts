// Feature "contatos" (WP1): lista com abas cliente/fornecedor, cadastro/edição e ficha com
// resumo financeiro e histórico. Páginas carregadas sob demanda (lazy).
import { Users } from 'lucide-react';

import type { AppModule } from '@/app/registry';

export const contatosModule: AppModule = {
  id: 'contatos',
  routes: [
    {
      path: '/contatos',
      lazy: async () => ({ Component: (await import('./pages/lista-page')).ContatosListaPage }),
    },
    {
      path: '/contatos/novo',
      lazy: async () => ({ Component: (await import('./pages/form-page')).NovoContatoPage }),
    },
    {
      path: '/contatos/:id',
      lazy: async () => ({
        Component: (await import('./pages/detalhe-page')).ContatoDetalhePage,
      }),
    },
    {
      path: '/contatos/:id/editar',
      lazy: async () => ({ Component: (await import('./pages/form-page')).EditarContatoPage }),
    },
  ],
  nav: [
    {
      id: 'contatos',
      label: 'Clientes e fornecedores',
      to: '/contatos',
      icon: Users,
      ordem: 40,
      mobile: false,
    },
  ],
};

export { contatosKeys } from './keys';
export {
  useAtualizarContato,
  useContato,
  useContatoLancamentos,
  useContatoResumo,
  useContatos,
  useContatosOpcoes,
  useCriarContato,
  useExcluirContato,
} from './hooks';
