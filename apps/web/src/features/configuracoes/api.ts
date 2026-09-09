// Chamadas HTTP de configurações e categorias (contratos em @meifin/shared).
import type {
  AtualizarCategoriaBody,
  AtualizarConfiguracoesBody,
  CategoriaResponse,
  ConfiguracoesResponse,
  CriarCategoriaBody,
  ExcluirCategoriaResponse,
  ListaCategoriasResponse,
  TipoLancamento,
} from '@meifin/shared';

import { api } from '@/lib/api/client';

export const configuracoesApi = {
  obter: () => api.get<ConfiguracoesResponse>('/configuracoes'),
  atualizar: (body: AtualizarConfiguracoesBody) =>
    api.patch<ConfiguracoesResponse>('/configuracoes', body),
};

export const categoriasApi = {
  listar: (tipo?: TipoLancamento) =>
    api.get<ListaCategoriasResponse>('/categorias', { query: { tipo, todas: true } }),
  criar: (body: CriarCategoriaBody) => api.post<CategoriaResponse>('/categorias', body),
  atualizar: (id: string, body: AtualizarCategoriaBody) =>
    api.patch<CategoriaResponse>(`/categorias/${id}`, body),
  excluir: (id: string) => api.delete<ExcluirCategoriaResponse>(`/categorias/${id}`),
};
