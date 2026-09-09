// Chamadas HTTP dos relatórios (contratos em @meifin/shared/schemas/relatorios). Cada relatório
// tem uma função de leitura (formato=json) e uma de download (csv/pdf) via baixarDaApi.
import type {
  ContasRelatorioQuery,
  ContasRelatorioResponse,
  DasnRelatorioQuery,
  DasnRelatorioResponse,
  DreQuery,
  DreResponse,
  ExtratoQuery,
  ExtratoResponse,
  LancamentosRelatorioQuery,
  LimiteRelatorioQuery,
  LimiteRelatorioResponse,
} from '@meifin/shared';

import { api } from '@/lib/api/client';
import { baixarDaApi } from '@/lib/api/download';
import type { QueryParams } from '@/lib/api/query';

type SemFormato<T> = Omit<T, 'formato'>;

export const relatoriosApi = {
  dre: (query: SemFormato<Partial<DreQuery>>) =>
    api.get<DreResponse>('/relatorios/dre', {
      query: { ...query, formato: 'json' } as QueryParams,
    }),
  extrato: (query: SemFormato<Partial<ExtratoQuery>>) =>
    api.get<ExtratoResponse>('/relatorios/extrato', {
      query: { ...query, formato: 'json' } as QueryParams,
    }),
  dasn: (query: SemFormato<Partial<DasnRelatorioQuery>>) =>
    api.get<DasnRelatorioResponse>('/relatorios/dasn', {
      query: { ...query, formato: 'json' } as QueryParams,
    }),
  limite: (query: SemFormato<Partial<LimiteRelatorioQuery>>) =>
    api.get<LimiteRelatorioResponse>('/relatorios/limite', {
      query: { ...query, formato: 'json' } as QueryParams,
    }),
  contas: (query: SemFormato<Partial<ContasRelatorioQuery>>) =>
    api.get<ContasRelatorioResponse>('/relatorios/contas', {
      query: { ...query, formato: 'json' } as QueryParams,
    }),
};

type Formato = 'csv' | 'pdf';

function baixar(path: string, nome: string, formato: Formato, query: QueryParams = {}) {
  return baixarDaApi(path, `${nome}.${formato}`, { query: { ...query, formato } });
}

export const relatoriosDownload = {
  dre: (formato: Formato, query: SemFormato<Partial<DreQuery>> = {}) =>
    baixar('/relatorios/dre', 'dre', formato, query as QueryParams),
  extrato: (formato: Formato, query: SemFormato<Partial<ExtratoQuery>> = {}) =>
    baixar('/relatorios/extrato', 'extrato', formato, query as QueryParams),
  dasn: (formato: Formato, query: SemFormato<Partial<DasnRelatorioQuery>> = {}) =>
    baixar('/relatorios/dasn', 'dasn', formato, query as QueryParams),
  limite: (formato: Formato, query: SemFormato<Partial<LimiteRelatorioQuery>> = {}) =>
    baixar('/relatorios/limite', 'limite-anual', formato, query as QueryParams),
  contas: (formato: Formato, query: SemFormato<Partial<ContasRelatorioQuery>> = {}) =>
    baixar('/relatorios/contas', 'contas', formato, query as QueryParams),
  lancamentos: (formato: Formato, query: SemFormato<Partial<LancamentosRelatorioQuery>> = {}) =>
    baixar('/relatorios/lancamentos', 'lancamentos', formato, query as QueryParams),
};
