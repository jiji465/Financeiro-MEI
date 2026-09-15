// Chamadas HTTP do módulo contas bancárias (contratos em @meifin/shared/schemas/contas-bancarias).
import type {
  AtualizarContaBancariaBody,
  ContaBancariaResponse,
  CriarContaBancariaBody,
  ListaContasBancariasResponse,
  OpcoesContasBancariasResponse,
} from '@meifin/shared';

import { api } from '@/lib/api/client';

export interface ListarContasBancariasParams {
  /** Omitido = ativas e inativas. */
  ativo?: boolean;
}

export const contasBancariasApi = {
  listar: (params: ListarContasBancariasParams = {}) =>
    api.get<ListaContasBancariasResponse>('/contas-bancarias', { query: { ...params } }),
  opcoes: () => api.get<OpcoesContasBancariasResponse>('/contas-bancarias/opcoes'),
  obter: (id: string) => api.get<ContaBancariaResponse>(`/contas-bancarias/${id}`),
  criar: (body: CriarContaBancariaBody) =>
    api.post<ContaBancariaResponse>('/contas-bancarias', body),
  atualizar: (id: string, body: AtualizarContaBancariaBody) =>
    api.patch<ContaBancariaResponse>(`/contas-bancarias/${id}`, body),
  excluir: (id: string) => api.delete<{ data: { ok: true } }>(`/contas-bancarias/${id}`),
};
