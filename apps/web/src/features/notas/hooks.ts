// Hooks de notas fiscais. Mutations invalidam notas/lançamentos/dashboard/relatórios e mostram
// toast de sucesso; erros de formulário são tratados inline (meta.silent).
import type {
  AtualizarNotaFiscalBody,
  CriarNotaFiscalBody,
  ListarNotasFiscaisQuery,
} from '@meifin/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notasApi, type CancelarNotaFiscalBody } from './api';
import { invalidarAposMutacaoNotas } from './invalidate';
import { notasKeys } from './keys';

export function useNotas(query: Partial<ListarNotasFiscaisQuery>) {
  return useQuery({
    queryKey: notasKeys.lista(query),
    queryFn: () => notasApi.listar(query),
  });
}

export function useNota(id: string | null | undefined) {
  return useQuery({
    queryKey: notasKeys.item(id ?? ''),
    queryFn: () => notasApi.obter(id!),
    select: (res) => res.data,
    enabled: Boolean(id),
  });
}

export function useResumoNotas(ano: number) {
  return useQuery({
    queryKey: notasKeys.resumo(ano),
    queryFn: () => notasApi.resumo(ano),
    select: (res) => res.data,
  });
}

export function useCriarNota() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CriarNotaFiscalBody) => notasApi.criar(body),
    onSuccess: () => invalidarAposMutacaoNotas(queryClient),
    meta: { silent: true, sucesso: 'Nota registrada' },
  });
}

export function useAtualizarNota() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AtualizarNotaFiscalBody }) =>
      notasApi.atualizar(id, body),
    onSuccess: () => invalidarAposMutacaoNotas(queryClient),
    meta: { silent: true, sucesso: 'Nota atualizada' },
  });
}

export function useCancelarNota() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: CancelarNotaFiscalBody }) =>
      notasApi.cancelar(id, body),
    onSuccess: () => invalidarAposMutacaoNotas(queryClient),
    meta: { silent: true, sucesso: 'Nota cancelada' },
  });
}

export function useExcluirNota() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notasApi.excluir(id),
    onSuccess: () => invalidarAposMutacaoNotas(queryClient),
    meta: { sucesso: 'Nota excluída' },
  });
}

export function useVincularNota() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, lancamentoId }: { id: string; lancamentoId: string | null }) =>
      notasApi.vincular(id, { lancamentoId }),
    onSuccess: () => invalidarAposMutacaoNotas(queryClient),
    meta: { sucesso: 'Vínculo atualizado' },
  });
}

export function useEnviarArquivoNota() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, arquivo }: { id: string; arquivo: File }) =>
      notasApi.enviarArquivo(id, arquivo),
    onSuccess: () => invalidarAposMutacaoNotas(queryClient),
    meta: { silent: true, sucesso: 'Arquivo enviado' },
  });
}

export function useRemoverArquivoNota() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notasApi.removerArquivo(id),
    onSuccess: () => invalidarAposMutacaoNotas(queryClient),
    meta: { sucesso: 'Arquivo removido' },
  });
}
