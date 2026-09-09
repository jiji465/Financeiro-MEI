// Hooks de lançamentos e recorrências (queries + mutations). Mutations invalidam
// lancamentos/recorrencias/contas/dashboard/relatorios/obrigacoes/contatos/referencias e mostram
// toast de sucesso; erros são tratados inline pelos formulários (meta.silent).
import type {
  AtualizarLancamentoBody,
  AtualizarRecorrenciaBody,
  CriarLancamentoBody,
  CriarRecorrenciaBody,
  GerarRecorrenciasBody,
  ListarLancamentosQuery,
  ListarRecorrenciasQuery,
  PagarLancamentoBody,
  ResumoLancamentosQuery,
} from '@meifin/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { lancamentosApi, recorrenciasApi } from './api';
import { invalidarAposMutacaoFinanceira } from './invalidate';
import { lancamentosKeys, recorrenciasKeys } from './keys';

function useInvalidar() {
  const queryClient = useQueryClient();
  return () => invalidarAposMutacaoFinanceira(queryClient);
}

// ---------------------------------------------------------------------------
// Lançamentos
// ---------------------------------------------------------------------------

export function useLancamentos(query: Partial<ListarLancamentosQuery>) {
  return useQuery({
    queryKey: lancamentosKeys.lista(query),
    queryFn: () => lancamentosApi.listar(query),
    placeholderData: keepPreviousData,
  });
}

export function useLancamento(id: string | null | undefined) {
  return useQuery({
    queryKey: lancamentosKeys.detalhe(id ?? ''),
    queryFn: () => lancamentosApi.obter(id!),
    select: (res) => res.data,
    enabled: Boolean(id),
  });
}

export function useResumoLancamentos(query: ResumoLancamentosQuery) {
  return useQuery({
    queryKey: lancamentosKeys.resumo(query),
    queryFn: () => lancamentosApi.resumo(query),
    select: (res) => res.data,
  });
}

export function useCriarLancamento() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (body: CriarLancamentoBody) => lancamentosApi.criar(body),
    onSuccess: () => invalidar(),
    meta: { silent: true, sucesso: 'Lançamento criado' },
  });
}

export function useAtualizarLancamento(id: string) {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (body: AtualizarLancamentoBody) => lancamentosApi.atualizar(id, body),
    onSuccess: () => invalidar(),
    meta: { silent: true, sucesso: 'Lançamento atualizado' },
  });
}

export function useExcluirLancamento() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: string) => lancamentosApi.excluir(id),
    onSuccess: () => invalidar(),
    meta: { sucesso: 'Lançamento excluído' },
  });
}

export function usePagarLancamento() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PagarLancamentoBody }) =>
      lancamentosApi.pagar(id, body),
    onSuccess: () => invalidar(),
    meta: { sucesso: 'Lançamento marcado como pago' },
  });
}

export function useEnviarAnexo(id: string) {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (arquivo: File) => lancamentosApi.enviarAnexo(id, arquivo),
    onSuccess: () => invalidar(),
    meta: { silent: true, sucesso: 'Anexo enviado' },
  });
}

export function useRemoverAnexo(id: string) {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: () => lancamentosApi.removerAnexo(id),
    onSuccess: () => invalidar(),
    meta: { sucesso: 'Anexo removido' },
  });
}

// ---------------------------------------------------------------------------
// Recorrências
// ---------------------------------------------------------------------------

export function useRecorrencias(query: Partial<ListarRecorrenciasQuery> = {}) {
  return useQuery({
    queryKey: recorrenciasKeys.lista(query),
    queryFn: () => recorrenciasApi.listar(query),
    select: (res) => res.data,
  });
}

export function useRecorrencia(id: string | null | undefined) {
  return useQuery({
    queryKey: recorrenciasKeys.detalhe(id ?? ''),
    queryFn: () => recorrenciasApi.obter(id!),
    select: (res) => res.data,
    enabled: Boolean(id),
  });
}

export function useCriarRecorrencia() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (body: CriarRecorrenciaBody) => recorrenciasApi.criar(body),
    onSuccess: () => invalidar(),
    meta: { silent: true, sucesso: 'Recorrência criada' },
  });
}

export function useAtualizarRecorrencia(id: string) {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (body: AtualizarRecorrenciaBody) => recorrenciasApi.atualizar(id, body),
    onSuccess: () => invalidar(),
    meta: { silent: true, sucesso: 'Recorrência atualizada' },
  });
}

export function useExcluirRecorrencia() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: string) => recorrenciasApi.excluir(id),
    onSuccess: () => invalidar(),
    meta: { sucesso: 'Recorrência excluída' },
  });
}

export function useGerarRecorrencias() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (body: GerarRecorrenciasBody = {}) => recorrenciasApi.gerar(body),
    onSuccess: () => invalidar(),
    meta: { silent: true },
  });
}
