// Chamadas HTTP do módulo contatos (contratos em @meifin/shared/schemas/contatos).
import type {
  AtualizarContatoBody,
  ContatoResponse,
  ContatoResumoResponse,
  CriarContatoBody,
  ListaContatosResponse,
  ListaLancamentosResponse,
  OpcoesContatosResponse,
  TipoContato,
} from '@meifin/shared';

import { api } from '@/lib/api/client';

export interface ListarContatosParams {
  tipo?: TipoContato | '';
  busca?: string;
  ativo?: boolean;
  page?: number;
  pageSize?: number;
  ordenarPor?: 'nome' | 'createdAt';
  ordem?: 'asc' | 'desc';
}

export interface HistoricoContatoParams {
  de?: string;
  ate?: string;
  page?: number;
  pageSize?: number;
}

export const contatosApi = {
  listar: (params: ListarContatosParams = {}) =>
    api.get<ListaContatosResponse>('/contatos', { query: { ...params } }),
  opcoes: (tipo?: TipoContato) =>
    api.get<OpcoesContatosResponse>('/contatos/opcoes', { query: { tipo } }),
  obter: (id: string) => api.get<ContatoResponse>(`/contatos/${id}`),
  criar: (body: CriarContatoBody) => api.post<ContatoResponse>('/contatos', body),
  atualizar: (id: string, body: AtualizarContatoBody) =>
    api.patch<ContatoResponse>(`/contatos/${id}`, body),
  excluir: (id: string) => api.delete<{ data: { ok: true } }>(`/contatos/${id}`),
  resumo: (id: string) => api.get<ContatoResumoResponse>(`/contatos/${id}/resumo`),
  lancamentos: (id: string, params: HistoricoContatoParams = {}) =>
    api.get<ListaLancamentosResponse>(`/contatos/${id}/lancamentos`, { query: { ...params } }),
};
