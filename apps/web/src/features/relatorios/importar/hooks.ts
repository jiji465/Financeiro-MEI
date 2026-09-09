// Hooks de importação CSV. A confirmação e o desfazer invalidam as mesmas chaves de uma mutação
// financeira comum (lancamentos/dashboard/relatorios/…) — reaproveita o helper da feature lancamentos.
import type {
  ConfirmarImportacaoBody,
  ListarImportacoesQuery,
  MapeamentoCsv,
} from '@meifin/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { invalidarAposMutacaoFinanceira } from '@/features/lancamentos/invalidate';

import { importacoesApi } from './api';
import { importacoesKeys } from './keys';

export function useImportacoes(query: Partial<ListarImportacoesQuery> = {}) {
  return useQuery({
    queryKey: importacoesKeys.lista(query),
    queryFn: () => importacoesApi.listar(query),
  });
}

export function useImportacao(id: string | null | undefined) {
  return useQuery({
    queryKey: importacoesKeys.detalhe(id ?? ''),
    queryFn: () => importacoesApi.obter(id!),
    select: (res) => res.data,
    enabled: Boolean(id),
  });
}

export function usePreviewImportacao() {
  return useMutation({
    mutationFn: ({ arquivo, mapeamento }: { arquivo: File; mapeamento: MapeamentoCsv }) =>
      importacoesApi.preview(arquivo, mapeamento),
    meta: { silent: true },
  });
}

export function useConfirmarImportacao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ConfirmarImportacaoBody) => importacoesApi.confirmar(body),
    onSuccess: () => invalidarAposMutacaoFinanceira(queryClient),
    meta: { silent: true },
  });
}

export function useDesfazerImportacao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => importacoesApi.desfazer(id),
    onSuccess: () => invalidarAposMutacaoFinanceira(queryClient),
    meta: { sucesso: 'Importação desfeita' },
  });
}
