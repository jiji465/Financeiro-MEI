// Chamadas HTTP do dashboard (contratos em @meifin/shared/schemas/dashboard).
import type {
  ComparativoMensalQuery,
  ComparativoMensalResponse,
  FluxoCaixaQuery,
  FluxoCaixaResponse,
  PorCategoriaQuery,
  PorCategoriaResponse,
  PorContatoQuery,
  PorContatoResponse,
  PorProdutoQuery,
  PorProdutoResponse,
  ResumoDashboardQuery,
  ResumoDashboardResponse,
} from '@meifin/shared';

import { api } from '@/lib/api/client';
import type { QueryParams } from '@/lib/api/query';

export const dashboardApi = {
  resumo: (query: Partial<ResumoDashboardQuery> = {}) =>
    api.get<ResumoDashboardResponse>('/dashboard/resumo', { query: query as QueryParams }),
  fluxoCaixa: (query: Partial<FluxoCaixaQuery> = {}) =>
    api.get<FluxoCaixaResponse>('/dashboard/fluxo-caixa', { query: query as QueryParams }),
  porCategoria: (query: Partial<PorCategoriaQuery> = {}) =>
    api.get<PorCategoriaResponse>('/dashboard/por-categoria', { query: query as QueryParams }),
  porContato: (query: Partial<PorContatoQuery> = {}) =>
    api.get<PorContatoResponse>('/dashboard/por-contato', { query: query as QueryParams }),
  porProduto: (query: Partial<PorProdutoQuery> = {}) =>
    api.get<PorProdutoResponse>('/dashboard/por-produto', { query: query as QueryParams }),
  comparativoMensal: (query: Partial<ComparativoMensalQuery> = {}) =>
    api.get<ComparativoMensalResponse>('/dashboard/comparativo-mensal', {
      query: query as QueryParams,
    }),
};
