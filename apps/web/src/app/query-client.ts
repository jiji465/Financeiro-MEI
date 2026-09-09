// QueryClient único da aplicação.
// - staleTime 30s; sem refetch ao focar a janela.
// - retry só para erros de servidor (≥500) ou de rede; nunca para 4xx.
// - Toda mutação com erro mostra toast, exceto quando `meta: { silent: true }` (a tela trata).
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { getErrorMessage, isApiError } from '@/lib/api/errors';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /** Não mostrar toast automático de erro (a tela exibe o erro inline). */
      silent?: boolean;
      /** Mensagem de sucesso exibida automaticamente. */
      sucesso?: string;
    };
    queryMeta: {
      /** Mostrar toast quando a query falhar (padrão: não — a tela usa ErrorState). */
      toastOnError?: boolean;
    };
  }
}

export function deveTentarNovamente(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (isApiError(error)) return error.isRede || error.status >= 500;
  return true;
}

export function criarQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: deveTentarNovamente,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.meta?.toastOnError) toast.error(getErrorMessage(error));
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variaveis, _contexto, mutation) => {
        if (mutation.meta?.silent) return;
        toast.error(getErrorMessage(error));
      },
      onSuccess: (_dados, _variaveis, _contexto, mutation) => {
        if (mutation.meta?.sucesso) toast.success(mutation.meta.sucesso);
      },
    }),
  });
}

export const queryClient = criarQueryClient();
