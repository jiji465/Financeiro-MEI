// Hooks das obrigações. Após pagar/desfazer DAS invalidamos obrigações, lançamentos, dashboard
// e relatórios (é dinheiro); DASN e alertas só mexem em ['obrigacoes'].
import type { RegistrarPagamentoDasBody, SalvarDasnBody } from '@meifin/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { obrigacoesApi } from './api';
import { obrigacoesKeys } from './keys';

const CHAVES_DINHEIRO = [['obrigacoes'], ['lancamentos'], ['dashboard'], ['relatorios']] as const;

export function useDasAno(ano: number) {
  return useQuery({
    queryKey: obrigacoesKeys.das(ano),
    queryFn: () => obrigacoesApi.das(ano),
    select: (res) => res.data,
  });
}

export function useDasn(anoBase: number) {
  return useQuery({
    queryKey: obrigacoesKeys.dasn(anoBase),
    queryFn: () => obrigacoesApi.dasn(anoBase),
    select: (res) => res.data,
  });
}

export function useLimite(ano: number) {
  return useQuery({
    queryKey: obrigacoesKeys.limite(ano),
    queryFn: () => obrigacoesApi.limite(ano),
    select: (res) => res.data,
  });
}

export function useAlertas() {
  return useQuery({
    queryKey: obrigacoesKeys.alertas(),
    queryFn: () => obrigacoesApi.alertas(),
    select: (res) => res.data,
  });
}

function useInvalidarDinheiro() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(CHAVES_DINHEIRO.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

export function useRegistrarPagamentoDas() {
  const invalidar = useInvalidarDinheiro();
  return useMutation({
    mutationFn: ({ competencia, body }: { competencia: string; body: RegistrarPagamentoDasBody }) =>
      obrigacoesApi.registrarPagamento(competencia, body),
    onSuccess: () => invalidar(),
    meta: { silent: true, sucesso: 'DAS marcado como pago. A despesa foi registrada.' },
  });
}

export function useDesfazerPagamentoDas() {
  const invalidar = useInvalidarDinheiro();
  return useMutation({
    mutationFn: (competencia: string) => obrigacoesApi.desfazerPagamento(competencia),
    onSuccess: () => invalidar(),
    meta: { sucesso: 'Pagamento desfeito. A despesa foi removida.' },
  });
}

export function useSalvarDasn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ anoBase, body }: { anoBase: number; body: SalvarDasnBody }) =>
      obrigacoesApi.salvarDasn(anoBase, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: obrigacoesKeys.all }),
    meta: { silent: true, sucesso: 'Declaração atualizada.' },
  });
}

export function useDispensarAlerta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (chave: string) => obrigacoesApi.dispensarAlerta(chave),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: obrigacoesKeys.alertas() }),
    meta: { sucesso: 'Alerta ocultado por 30 dias.' },
  });
}

export function useReativarAlerta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (chave: string) => obrigacoesApi.reativarAlerta(chave),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: obrigacoesKeys.alertas() }),
  });
}
