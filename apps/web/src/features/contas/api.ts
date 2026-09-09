// Chamadas HTTP de títulos/parcelas (contratos em @meifin/shared/schemas/titulos).
import type {
  AtualizarParcelaBody,
  AtualizarTituloBody,
  BaixaParcelaBody,
  BaixaParcelaResponse,
  CriarTituloBody,
  ListaParcelasResponse,
  ListarParcelasQuery,
  ListarTitulosQuery,
  ListaTitulosResponse,
  ParcelaResponse,
  ResumoParcelasResponse,
  TituloResponse,
} from '@meifin/shared';

import { api } from '@/lib/api/client';
import type { QueryParams } from '@/lib/api/query';

export const contasApi = {
  listarParcelas: (query: Partial<ListarParcelasQuery>) =>
    api.get<ListaParcelasResponse>('/parcelas', { query: query as QueryParams }),
  obterParcela: (id: string) => api.get<ParcelaResponse>(`/parcelas/${id}`),
  resumo: (dias: number) =>
    api.get<ResumoParcelasResponse>('/parcelas/resumo', { query: { dias } }),
  baixar: (id: string, body: BaixaParcelaBody) =>
    api.post<BaixaParcelaResponse>(`/parcelas/${id}/baixa`, body),
  estornar: (id: string) => api.delete<ParcelaResponse>(`/parcelas/${id}/baixa`),
  atualizarParcela: (id: string, body: AtualizarParcelaBody) =>
    api.patch<ParcelaResponse>(`/parcelas/${id}`, body),

  listarTitulos: (query: Partial<ListarTitulosQuery>) =>
    api.get<ListaTitulosResponse>('/titulos', { query: query as QueryParams }),
  obterTitulo: (id: string) => api.get<TituloResponse>(`/titulos/${id}`),
  criarTitulo: (body: CriarTituloBody) => api.post<TituloResponse>('/titulos', body),
  atualizarTitulo: (id: string, body: AtualizarTituloBody) =>
    api.patch<TituloResponse>(`/titulos/${id}`, body),
  cancelarTitulo: (id: string) => api.delete<TituloResponse>(`/titulos/${id}`),
};
