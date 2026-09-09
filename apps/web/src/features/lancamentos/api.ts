// Chamadas HTTP de lançamentos e recorrências (contratos em @meifin/shared/schemas/lancamentos).
import type {
  AtualizarLancamentoBody,
  AtualizarRecorrenciaBody,
  CriarLancamentoBody,
  CriarRecorrenciaBody,
  GerarRecorrenciasBody,
  GerarRecorrenciasResponse,
  LancamentoResponse,
  ListaLancamentosResponse,
  ListaRecorrenciasResponse,
  ListarLancamentosQuery,
  ListarRecorrenciasQuery,
  PagarLancamentoBody,
  RecorrenciaResponse,
  ResumoLancamentosQuery,
  ResumoLancamentosResponse,
} from '@meifin/shared';

import { api, type ArquivoBaixado } from '@/lib/api/client';
import type { QueryParams } from '@/lib/api/query';

export const lancamentosApi = {
  listar: (query: Partial<ListarLancamentosQuery>) =>
    api.get<ListaLancamentosResponse>('/lancamentos', { query: query as QueryParams }),
  obter: (id: string) => api.get<LancamentoResponse>(`/lancamentos/${id}`),
  resumo: (query: ResumoLancamentosQuery) =>
    api.get<ResumoLancamentosResponse>('/lancamentos/resumo', { query: query as QueryParams }),
  criar: (body: CriarLancamentoBody) => api.post<LancamentoResponse>('/lancamentos', body),
  atualizar: (id: string, body: AtualizarLancamentoBody) =>
    api.patch<LancamentoResponse>(`/lancamentos/${id}`, body),
  excluir: (id: string) => api.delete<void>(`/lancamentos/${id}`),
  pagar: (id: string, body: PagarLancamentoBody) =>
    api.post<LancamentoResponse>(`/lancamentos/${id}/pagar`, body),
  enviarAnexo: (id: string, arquivo: File) => {
    const formData = new FormData();
    formData.append('arquivo', arquivo, arquivo.name);
    return api.upload<LancamentoResponse>(`/lancamentos/${id}/anexo`, formData);
  },
  baixarAnexo: (id: string): Promise<ArquivoBaixado> => api.blob(`/lancamentos/${id}/anexo`),
  removerAnexo: (id: string) => api.delete<void>(`/lancamentos/${id}/anexo`),
};

export const recorrenciasApi = {
  listar: (query: Partial<ListarRecorrenciasQuery> = {}) =>
    api.get<ListaRecorrenciasResponse>('/recorrencias', { query: query as QueryParams }),
  obter: (id: string) => api.get<RecorrenciaResponse>(`/recorrencias/${id}`),
  criar: (body: CriarRecorrenciaBody) => api.post<RecorrenciaResponse>('/recorrencias', body),
  atualizar: (id: string, body: AtualizarRecorrenciaBody) =>
    api.patch<RecorrenciaResponse>(`/recorrencias/${id}`, body),
  excluir: (id: string) => api.delete<void>(`/recorrencias/${id}`),
  gerar: (body: GerarRecorrenciasBody = {}) =>
    api.post<GerarRecorrenciasResponse>('/recorrencias/gerar', body),
};
