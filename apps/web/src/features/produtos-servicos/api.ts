// Chamadas HTTP do catálogo (contratos em @meifin/shared/schemas/produtos-servicos).
import type {
  AtualizarProdutoServicoBody,
  CriarProdutoServicoBody,
  ListaProdutosServicosResponse,
  OpcoesProdutosServicosResponse,
  ProdutoServicoResponse,
  TipoProdutoServico,
} from '@meifin/shared';

import { api } from '@/lib/api/client';

export interface ListarProdutosServicosParams {
  tipo?: TipoProdutoServico;
  /** Omitido = ativos e inativos. */
  ativo?: boolean;
  busca?: string;
}

export const produtosServicosApi = {
  listar: (params: ListarProdutosServicosParams = {}) =>
    api.get<ListaProdutosServicosResponse>('/produtos-servicos', { query: { ...params } }),
  opcoes: (tipo?: TipoProdutoServico) =>
    api.get<OpcoesProdutosServicosResponse>('/produtos-servicos/opcoes', { query: { tipo } }),
  obter: (id: string) => api.get<ProdutoServicoResponse>(`/produtos-servicos/${id}`),
  criar: (body: CriarProdutoServicoBody) =>
    api.post<ProdutoServicoResponse>('/produtos-servicos', body),
  atualizar: (id: string, body: AtualizarProdutoServicoBody) =>
    api.patch<ProdutoServicoResponse>(`/produtos-servicos/${id}`, body),
  excluir: (id: string) => api.delete<{ data: { ok: true } }>(`/produtos-servicos/${id}`),
};
