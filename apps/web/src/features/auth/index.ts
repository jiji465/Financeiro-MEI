// Feature "auth": rotas públicas (montadas pelo router dentro de AuthLayout + RedirectIfAuth).
// Sem itens de navegação. Páginas carregadas sob demanda (lazy).
import type { AppModule } from '@/app/registry';

export const authModule: AppModule = {
  id: 'auth',
  routes: [
    {
      path: '/entrar',
      lazy: async () => ({ Component: (await import('./pages/login-page')).LoginPage }),
    },
    {
      path: '/cadastro',
      lazy: async () => ({ Component: (await import('./pages/cadastro-page')).CadastroPage }),
    },
    {
      path: '/esqueci-senha',
      lazy: async () => ({
        Component: (await import('./pages/esqueci-senha-page')).EsqueciSenhaPage,
      }),
    },
    {
      path: '/redefinir-senha',
      lazy: async () => ({
        Component: (await import('./pages/redefinir-senha-page')).RedefinirSenhaPage,
      }),
    },
  ],
  nav: [],
};
