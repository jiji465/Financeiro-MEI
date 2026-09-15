// Hooks do catálogo (queries + mutations).
//
// Cadastrar um produto não mexe em dinheiro — mas o preço padrão que ele sugere e a contagem de
// uso que ele exibe vivem ao lado dos lançamentos, então usamos o mesmo helper financeiro das
// outras features de escrita: ele já inclui ['produtos-servicos'] e as chaves que derivam de
// lançamentos, e evita que o seletor de itens fique servindo preço velho.
import type { AtualizarProdutoServicoBody, CriarProdutoServicoBody } from '@meifin/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { invalidarAposMutacaoFinanceira } from '@/features/lancamentos/invalidate';

import { produtosServicosApi, type ListarProdutosServicosParams } from './api';
import { produtosServicosKeys } from './keys';

function useInvalidar() {
  const queryClient = useQueryClient();
  return () => invalidarAposMutacaoFinanceira(queryClient);
}

export function useProdutosServicos(params: ListarProdutosServicosParams = {}) {
  return useQuery({
    queryKey: produtosServicosKeys.lista({ ...params }),
    queryFn: () => produtosServicosApi.listar(params),
    select: (res) => res.data,
  });
}

export function useProdutoServico(id: string | null | undefined) {
  return useQuery({
    queryKey: produtosServicosKeys.detalhe(id ?? ''),
    queryFn: () => produtosServicosApi.obter(id!),
    select: (res) => res.data,
    enabled: Boolean(id),
  });
}

export function useCriarProdutoServico() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (body: CriarProdutoServicoBody) => produtosServicosApi.criar(body),
    onSuccess: () => invalidar(),
    meta: { silent: true, sucesso: 'Item cadastrado' },
  });
}

export function useAtualizarProdutoServico(id: string) {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (body: AtualizarProdutoServicoBody) => produtosServicosApi.atualizar(id, body),
    onSuccess: () => invalidar(),
    meta: { silent: true, sucesso: 'Item atualizado' },
  });
}

export function useExcluirProdutoServico() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: string) => produtosServicosApi.excluir(id),
    onSuccess: () => invalidar(),
    meta: { sucesso: 'Item excluído do catálogo' },
  });
}
