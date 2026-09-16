// Chamadas HTTP do módulo contas bancárias (contratos em @meifin/shared/schemas/contas-bancarias).
import type {
  AtualizarContaBancariaBody,
  ContaBancariaResponse,
  CriarContaBancariaBody,
  CriarTransferenciaBody,
  ListaContasBancariasResponse,
  ListaTransferenciasResponse,
  OpcoesContasBancariasResponse,
  TransferenciaResponse,
} from '@meifin/shared';

import { api } from '@/lib/api/client';

export interface ListarContasBancariasParams {
  /** Omitido = ativas e inativas. */
  ativo?: boolean;
}

export interface ListarTransferenciasParams {
  de?: string;
  ate?: string;
  /** Saíram OU entraram nesta conta. */
  contaId?: string;
  page?: number;
  pageSize?: number;
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

  listarTransferencias: (params: ListarTransferenciasParams = {}) =>
    api.get<ListaTransferenciasResponse>('/contas-bancarias/transferencias', {
      query: { ...params },
    }),
  criarTransferencia: (body: CriarTransferenciaBody) =>
    api.post<TransferenciaResponse>('/contas-bancarias/transferencias', body),
  estornarTransferencia: (id: string) =>
    api.delete<{ data: { ok: true } }>(`/contas-bancarias/transferencias/${id}`),
};
