// Chamadas HTTP das obrigações (contratos em @meifin/shared/schemas/obrigacoes).
import type {
  AlertasResponse,
  CalendarioResponse,
  DasAnoResponse,
  DasCompetenciaDto,
  DasnResponse,
  DispensarAlertaBody,
  DispensarAlertaResponse,
  LimiteResponse,
  PagamentoDasResponse,
  RegistrarPagamentoDasBody,
  SalvarDasnBody,
} from '@meifin/shared';

import { api } from '@/lib/api/client';

export const obrigacoesApi = {
  das: (ano: number) => api.get<DasAnoResponse>('/obrigacoes/das', { query: { ano } }),
  registrarPagamento: (competencia: string, body: RegistrarPagamentoDasBody) =>
    api.post<PagamentoDasResponse>(`/obrigacoes/das/${competencia}/pagamento`, body),
  desfazerPagamento: (competencia: string) =>
    api.delete<{ data: DasCompetenciaDto }>(`/obrigacoes/das/${competencia}/pagamento`),
  dasn: (anoBase: number) => api.get<DasnResponse>('/obrigacoes/dasn', { query: { ano: anoBase } }),
  salvarDasn: (anoBase: number, body: SalvarDasnBody) =>
    api.put<DasnResponse>(`/obrigacoes/dasn/${anoBase}`, body),
  limite: (ano: number) => api.get<LimiteResponse>('/obrigacoes/limite', { query: { ano } }),
  calendario: (de: string, ate: string) =>
    api.get<CalendarioResponse>('/obrigacoes/calendario', { query: { de, ate } }),
  alertas: () => api.get<AlertasResponse>('/obrigacoes/alertas'),
  dispensarAlerta: (chave: string, body: DispensarAlertaBody = {}) =>
    api.post<DispensarAlertaResponse>(
      `/obrigacoes/alertas/${encodeURIComponent(chave)}/dispensar`,
      body,
    ),
  reativarAlerta: (chave: string) =>
    api.delete(`/obrigacoes/alertas/${encodeURIComponent(chave)}/dispensar`),
};
