// Hooks de contas bancárias (queries + mutations). Toda mutação aqui mexe em dinheiro (o saldo
// inicial entra no saldo da conta), então invalidamos pelo helper financeiro compartilhado —
// que já inclui ['contas-bancarias'] e as features que derivam de lançamentos.
import type {
  AtualizarContaBancariaBody,
  CriarContaBancariaBody,
  CriarTransferenciaBody,
} from '@meifin/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { invalidarAposMutacaoFinanceira } from '@/features/lancamentos/invalidate';

import {
  contasBancariasApi,
  type ListarContasBancariasParams,
  type ListarTransferenciasParams,
} from './api';
import { contasBancariasKeys } from './keys';

function useInvalidar() {
  const queryClient = useQueryClient();
  return () => invalidarAposMutacaoFinanceira(queryClient);
}

export function useContasBancarias(params: ListarContasBancariasParams = {}) {
  return useQuery({
    queryKey: contasBancariasKeys.lista({ ...params }),
    queryFn: () => contasBancariasApi.listar(params),
  });
}

export function useContaBancaria(id: string | null | undefined) {
  return useQuery({
    queryKey: contasBancariasKeys.detalhe(id ?? ''),
    queryFn: () => contasBancariasApi.obter(id!),
    select: (res) => res.data,
    enabled: Boolean(id),
  });
}

export function useCriarContaBancaria() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (body: CriarContaBancariaBody) => contasBancariasApi.criar(body),
    onSuccess: () => invalidar(),
    meta: { silent: true, sucesso: 'Conta cadastrada' },
  });
}

export function useAtualizarContaBancaria(id: string) {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (body: AtualizarContaBancariaBody) => contasBancariasApi.atualizar(id, body),
    onSuccess: () => invalidar(),
    meta: { silent: true, sucesso: 'Conta atualizada' },
  });
}

export function useExcluirContaBancaria() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: string) => contasBancariasApi.excluir(id),
    onSuccess: () => invalidar(),
    meta: { sucesso: 'Conta excluída' },
  });
}

export function useTransferencias(params: ListarTransferenciasParams = {}) {
  return useQuery({
    queryKey: contasBancariasKeys.transferencias({ ...params }),
    queryFn: () => contasBancariasApi.listarTransferencias(params),
  });
}

export function useCriarTransferencia() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (body: CriarTransferenciaBody) => contasBancariasApi.criarTransferencia(body),
    onSuccess: () => invalidar(),
    meta: { silent: true, sucesso: 'Transferência registrada' },
  });
}

export function useEstornarTransferencia() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: string) => contasBancariasApi.estornarTransferencia(id),
    onSuccess: () => invalidar(),
    meta: { sucesso: 'Transferência estornada' },
  });
}
