// Hooks de contas a pagar/receber. Mutations invalidam contas/lançamentos/dashboard/… e mostram
// toast de sucesso; erros são tratados inline pelos formulários (meta.silent).
import type {
  AtualizarTituloBody,
  BaixaParcelaBody,
  CriarTituloBody,
  ListarParcelasQuery,
  ListarTitulosQuery,
} from '@meifin/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { contasApi } from './api';
import { invalidarAposMutacaoFinanceira } from './invalidate';
import { contasKeys } from './keys';

export function useParcelas(
  query: Partial<ListarParcelasQuery>,
  opcoes: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: contasKeys.parcelas(query),
    queryFn: () => contasApi.listarParcelas(query),
    enabled: opcoes.enabled ?? true,
  });
}

export function useParcela(id: string | null | undefined) {
  return useQuery({
    queryKey: contasKeys.parcela(id ?? ''),
    queryFn: () => contasApi.obterParcela(id!),
    select: (res) => res.data,
    enabled: Boolean(id),
  });
}

export function useResumoParcelas(dias = 30) {
  return useQuery({
    queryKey: contasKeys.resumo(dias),
    queryFn: () => contasApi.resumo(dias),
    select: (res) => res.data,
  });
}

export function useTitulos(query: Partial<ListarTitulosQuery>) {
  return useQuery({
    queryKey: contasKeys.titulos(query),
    queryFn: () => contasApi.listarTitulos(query),
  });
}

export function useTitulo(id: string | null | undefined) {
  return useQuery({
    queryKey: contasKeys.titulo(id ?? ''),
    queryFn: () => contasApi.obterTitulo(id!),
    select: (res) => res.data,
    enabled: Boolean(id),
  });
}

export function useBaixarParcela() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: BaixaParcelaBody }) =>
      contasApi.baixar(id, body),
    onSuccess: () => invalidarAposMutacaoFinanceira(queryClient),
    meta: { silent: true, sucesso: 'Parcela baixada com sucesso' },
  });
}

export function useEstornarParcela() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => contasApi.estornar(id),
    onSuccess: () => invalidarAposMutacaoFinanceira(queryClient),
    meta: { sucesso: 'Baixa estornada' },
  });
}

export function useCriarTitulo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CriarTituloBody) => contasApi.criarTitulo(body),
    onSuccess: () => invalidarAposMutacaoFinanceira(queryClient),
    meta: { silent: true, sucesso: 'Conta criada' },
  });
}

export function useAtualizarTitulo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AtualizarTituloBody }) =>
      contasApi.atualizarTitulo(id, body),
    onSuccess: () => invalidarAposMutacaoFinanceira(queryClient),
    meta: { silent: true, sucesso: 'Conta atualizada' },
  });
}

export function useCancelarTitulo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => contasApi.cancelarTitulo(id),
    onSuccess: () => invalidarAposMutacaoFinanceira(queryClient),
    meta: { sucesso: 'Conta cancelada' },
  });
}
