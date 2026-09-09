// Hooks de configurações e categorias. Depois de salvar configurações invalidamos
// ['configuracoes'], ['auth'] (nome/atividade do MEI no topo), ['referencias'] e ['obrigacoes']
// (atividade e data de abertura mudam o DAS e o limite). Categorias invalidam referências também.
import type {
  AtualizarCategoriaBody,
  AtualizarConfiguracoesBody,
  CriarCategoriaBody,
  TipoLancamento,
} from '@meifin/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { categoriasApi, configuracoesApi } from './api';
import { configuracoesKeys } from './keys';

const CHAVES_APOS_CONFIG = [['configuracoes'], ['auth'], ['referencias'], ['obrigacoes']] as const;
const CHAVES_APOS_CATEGORIA = [
  ['configuracoes', 'categorias'],
  ['referencias'],
  ['obrigacoes'],
] as const;

export function useConfiguracoes() {
  return useQuery({
    queryKey: configuracoesKeys.atual(),
    queryFn: () => configuracoesApi.obter(),
    select: (res) => res.data,
    staleTime: 5 * 60_000,
  });
}

export function useAtualizarConfiguracoes(mensagem = 'Configurações salvas.') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AtualizarConfiguracoesBody) => configuracoesApi.atualizar(body),
    onSuccess: async (res) => {
      queryClient.setQueryData(configuracoesKeys.atual(), res);
      await Promise.all(
        CHAVES_APOS_CONFIG.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
    },
    meta: { silent: true, sucesso: mensagem },
  });
}

export function useCategoriasConfig(tipo?: TipoLancamento) {
  return useQuery({
    queryKey: configuracoesKeys.categorias(tipo),
    queryFn: () => categoriasApi.listar(tipo),
    select: (res) => res.data,
  });
}

function useInvalidarCategorias() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      CHAVES_APOS_CATEGORIA.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
}

export function useCriarCategoria() {
  const invalidar = useInvalidarCategorias();
  return useMutation({
    mutationFn: (body: CriarCategoriaBody) => categoriasApi.criar(body),
    onSuccess: () => invalidar(),
    meta: { silent: true, sucesso: 'Categoria criada.' },
  });
}

export function useAtualizarCategoria() {
  const invalidar = useInvalidarCategorias();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AtualizarCategoriaBody }) =>
      categoriasApi.atualizar(id, body),
    onSuccess: () => invalidar(),
    meta: { silent: true, sucesso: 'Categoria atualizada.' },
  });
}

export function useExcluirCategoria() {
  const invalidar = useInvalidarCategorias();
  return useMutation({
    mutationFn: (id: string) => categoriasApi.excluir(id),
    onSuccess: () => invalidar(),
  });
}
