// Hooks da feature contatos (queries + mutations). Após qualquer mutação invalidamos
// ['contatos'] e ['referencias'] (comboboxes de contato usados por lançamentos, contas, notas).
import type { AtualizarContatoBody, CriarContatoBody, TipoContato } from '@meifin/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { referenciasKeys } from '@/features/referencias/keys';

import { contatosApi, type HistoricoContatoParams, type ListarContatosParams } from './api';
import { contatosKeys } from './keys';

export function useContatos(params: ListarContatosParams = {}) {
  return useQuery({
    queryKey: contatosKeys.lista({ ...params }),
    queryFn: () => contatosApi.listar(params),
    placeholderData: keepPreviousData,
  });
}

export function useContatosOpcoes(tipo?: TipoContato) {
  return useQuery({
    queryKey: contatosKeys.opcoes(tipo),
    queryFn: () => contatosApi.opcoes(tipo),
    staleTime: 5 * 60_000,
    select: (res) => res.data,
  });
}

export function useContato(id: string | undefined) {
  return useQuery({
    queryKey: contatosKeys.detalhe(id ?? ''),
    queryFn: () => contatosApi.obter(id!),
    enabled: Boolean(id),
    select: (res) => res.data,
  });
}

export function useContatoResumo(id: string | undefined) {
  return useQuery({
    queryKey: contatosKeys.resumo(id ?? ''),
    queryFn: () => contatosApi.resumo(id!),
    enabled: Boolean(id),
    select: (res) => res.data,
  });
}

export function useContatoLancamentos(id: string | undefined, params: HistoricoContatoParams = {}) {
  return useQuery({
    queryKey: contatosKeys.lancamentos(id ?? '', { ...params }),
    queryFn: () => contatosApi.lancamentos(id!, params),
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
  });
}

function useInvalidarContatos() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: contatosKeys.all }),
      queryClient.invalidateQueries({ queryKey: referenciasKeys.all }),
    ]);
}

export function useCriarContato() {
  const invalidar = useInvalidarContatos();
  return useMutation({
    mutationFn: (body: CriarContatoBody) => contatosApi.criar(body),
    onSuccess: () => invalidar(),
    meta: { silent: true, sucesso: 'Contato cadastrado' },
  });
}

export function useAtualizarContato(id: string) {
  const invalidar = useInvalidarContatos();
  return useMutation({
    mutationFn: (body: AtualizarContatoBody) => contatosApi.atualizar(id, body),
    onSuccess: () => invalidar(),
    meta: { silent: true, sucesso: 'Contato atualizado' },
  });
}

export function useExcluirContato() {
  const invalidar = useInvalidarContatos();
  return useMutation({
    mutationFn: (id: string) => contatosApi.excluir(id),
    onSuccess: () => invalidar(),
    meta: { sucesso: 'Contato excluído' },
  });
}
