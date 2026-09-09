// Hooks do dashboard: um staleTime curto (1 min) porque os números mudam a cada lançamento,
// mas não vale a pena refazer a busca a cada render.
import type {
  ComparativoMensalQuery,
  FluxoCaixaQuery,
  PorCategoriaQuery,
  PorContatoQuery,
  ResumoDashboardQuery,
} from '@meifin/shared';
import { useQuery } from '@tanstack/react-query';

import { dashboardApi } from './api';
import { dashboardKeys } from './keys';

const UM_MINUTO = 60_000;

export function useResumoDashboard(query: Partial<ResumoDashboardQuery> = {}) {
  return useQuery({
    queryKey: dashboardKeys.resumo(query),
    queryFn: () => dashboardApi.resumo(query),
    select: (res) => res.data,
    staleTime: UM_MINUTO,
  });
}

export function useFluxoCaixa(query: Partial<FluxoCaixaQuery> = {}) {
  return useQuery({
    queryKey: dashboardKeys.fluxoCaixa(query),
    queryFn: () => dashboardApi.fluxoCaixa(query),
    select: (res) => res.data,
    staleTime: UM_MINUTO,
  });
}

export function usePorCategoria(query: Partial<PorCategoriaQuery> = {}) {
  return useQuery({
    queryKey: dashboardKeys.porCategoria(query),
    queryFn: () => dashboardApi.porCategoria(query),
    select: (res) => res.data,
    staleTime: UM_MINUTO,
  });
}

export function usePorContato(query: Partial<PorContatoQuery> = {}) {
  return useQuery({
    queryKey: dashboardKeys.porContato(query),
    queryFn: () => dashboardApi.porContato(query),
    select: (res) => res.data,
    staleTime: UM_MINUTO,
  });
}

export function useComparativoMensal(query: Partial<ComparativoMensalQuery> = {}) {
  return useQuery({
    queryKey: dashboardKeys.comparativoMensal(query),
    queryFn: () => dashboardApi.comparativoMensal(query),
    select: (res) => res.data,
    staleTime: UM_MINUTO,
  });
}
