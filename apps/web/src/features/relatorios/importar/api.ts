// Chamadas HTTP de importação CSV (contratos em @meifin/shared/schemas/importacoes).
import type {
  ConfirmarImportacaoBody,
  DesfazerImportacaoResponse,
  ImportacaoResponse,
  ListaImportacoesResponse,
  ListarImportacoesQuery,
  MapeamentoCsv,
  PreviewImportacaoResponse,
} from '@meifin/shared';

import { api } from '@/lib/api/client';
import type { QueryParams } from '@/lib/api/query';

export const importacoesApi = {
  preview: (arquivo: File, mapeamento: MapeamentoCsv) => {
    const formData = new FormData();
    formData.append('arquivo', arquivo, arquivo.name);
    formData.append('mapeamento', JSON.stringify(mapeamento));
    return api.upload<PreviewImportacaoResponse>('/importacoes/csv/preview', formData);
  },
  confirmar: (body: ConfirmarImportacaoBody) =>
    api.post<ImportacaoResponse>('/importacoes/csv/confirmar', body),
  listar: (query: Partial<ListarImportacoesQuery> = {}) =>
    api.get<ListaImportacoesResponse>('/importacoes', { query: query as QueryParams }),
  obter: (id: string) => api.get<ImportacaoResponse>(`/importacoes/${id}`),
  desfazer: (id: string) => api.delete<DesfazerImportacaoResponse>(`/importacoes/${id}`),
};
