// Hooks dos relatórios: uma query por relatório (visualização em JSON) e uma mutation por
// download (csv/pdf) — assim os botões "Exportar" ganham loading e toast de erro automáticos.
import type {
  ContasRelatorioQuery,
  DasnRelatorioQuery,
  DreQuery,
  ExtratoQuery,
  LancamentosRelatorioQuery,
  LimiteRelatorioQuery,
} from '@meifin/shared';
import { useMutation, useQuery } from '@tanstack/react-query';

import { relatoriosApi, relatoriosDownload } from './api';
import { relatoriosKeys } from './keys';

type SemFormato<T> = Omit<T, 'formato'>;
type Formato = 'csv' | 'pdf';

export function useDre(query: SemFormato<Partial<DreQuery>>, opcoes: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: relatoriosKeys.dre(query),
    queryFn: () => relatoriosApi.dre(query),
    select: (res) => res.data,
    enabled: opcoes.enabled ?? true,
  });
}

export function useExtrato(
  query: SemFormato<Partial<ExtratoQuery>>,
  opcoes: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: relatoriosKeys.extrato(query),
    queryFn: () => relatoriosApi.extrato(query),
    select: (res) => res.data,
    enabled: opcoes.enabled ?? true,
  });
}

export function useDasnRelatorio(query: SemFormato<Partial<DasnRelatorioQuery>>) {
  return useQuery({
    queryKey: relatoriosKeys.dasn(query),
    queryFn: () => relatoriosApi.dasn(query),
    select: (res) => res.data,
  });
}

export function useLimiteRelatorio(query: SemFormato<Partial<LimiteRelatorioQuery>>) {
  return useQuery({
    queryKey: relatoriosKeys.limite(query),
    queryFn: () => relatoriosApi.limite(query),
    select: (res) => res.data,
  });
}

export function useContasRelatorio(query: SemFormato<Partial<ContasRelatorioQuery>> = {}) {
  return useQuery({
    queryKey: relatoriosKeys.contas(query),
    queryFn: () => relatoriosApi.contas(query),
    select: (res) => res.data,
  });
}

function useDownload<Q>(baixar: (formato: Formato, query: Q) => Promise<void>) {
  return useMutation({
    mutationFn: ({ formato, query }: { formato: Formato; query: Q }) => baixar(formato, query),
    meta: { silent: false },
  });
}

export function useBaixarDre() {
  return useDownload<SemFormato<Partial<DreQuery>>>(relatoriosDownload.dre);
}
export function useBaixarExtrato() {
  return useDownload<SemFormato<Partial<ExtratoQuery>>>(relatoriosDownload.extrato);
}
export function useBaixarDasn() {
  return useDownload<SemFormato<Partial<DasnRelatorioQuery>>>(relatoriosDownload.dasn);
}
export function useBaixarLimite() {
  return useDownload<SemFormato<Partial<LimiteRelatorioQuery>>>(relatoriosDownload.limite);
}
export function useBaixarContas() {
  return useDownload<SemFormato<Partial<ContasRelatorioQuery>>>(relatoriosDownload.contas);
}
export function useBaixarLancamentos() {
  return useDownload<SemFormato<Partial<LancamentosRelatorioQuery>>>(
    relatoriosDownload.lancamentos,
  );
}
