// Chamadas HTTP de notas fiscais (contratos em @meifin/shared/schemas/notas).
import type {
  AnexoDto,
  AtualizarNotaFiscalBody,
  CriarNotaFiscalBody,
  CriarNotaFiscalResponse,
  ListaNotasFiscaisResponse,
  ListarNotasFiscaisQuery,
  NotaFiscalDto,
  NotaFiscalResponse,
  ResumoNotasFiscaisResponse,
  VincularNotaFiscalBody,
} from '@meifin/shared';

import { api, type ArquivoBaixado } from '@/lib/api/client';
import type { QueryParams } from '@/lib/api/query';

/** POST /:id/cancelar — não faz parte de @meifin/shared (resposta específica da rota da API). */
export interface CancelarNotaFiscalBody {
  dataCancelamento?: string;
  motivoCancelamento: string;
  estornarReceita?: boolean;
}

export interface CancelarNotaFiscalResponse {
  data: {
    nota: NotaFiscalDto;
    lancamentoVinculado: { id: string; excluido: boolean } | null;
  };
}

export const notasApi = {
  listar: (query: Partial<ListarNotasFiscaisQuery>) =>
    api.get<ListaNotasFiscaisResponse>('/notas-fiscais', { query: query as QueryParams }),
  obter: (id: string) => api.get<NotaFiscalResponse>(`/notas-fiscais/${id}`),
  resumo: (ano: number) =>
    api.get<ResumoNotasFiscaisResponse>('/notas-fiscais/resumo', { query: { ano } }),
  criar: (body: CriarNotaFiscalBody) => api.post<CriarNotaFiscalResponse>('/notas-fiscais', body),
  atualizar: (id: string, body: AtualizarNotaFiscalBody) =>
    api.patch<NotaFiscalResponse>(`/notas-fiscais/${id}`, body),
  excluir: (id: string) => api.delete<void>(`/notas-fiscais/${id}`),
  cancelar: (id: string, body: CancelarNotaFiscalBody) =>
    api.post<CancelarNotaFiscalResponse>(`/notas-fiscais/${id}/cancelar`, body),
  vincular: (id: string, body: VincularNotaFiscalBody) =>
    api.post<NotaFiscalResponse>(`/notas-fiscais/${id}/vincular`, body),
  enviarArquivo: (id: string, arquivo: File) => {
    const formData = new FormData();
    formData.append('arquivo', arquivo, arquivo.name);
    return api.upload<{ data: AnexoDto }>(`/notas-fiscais/${id}/arquivo`, formData);
  },
  baixarArquivo: (id: string): Promise<ArquivoBaixado> => api.blob(`/notas-fiscais/${id}/arquivo`),
  removerArquivo: (id: string) => api.delete<void>(`/notas-fiscais/${id}/arquivo`),
};
