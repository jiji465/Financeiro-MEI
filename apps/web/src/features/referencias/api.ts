// Leituras compartilhadas por várias features. Os tipos abaixo são o mínimo que o web usa;
// quando os schemas de categorias/contatos/obrigacoes do @meifin/shared estiverem publicados,
// troque por `z.infer` deles (ver docs/handoff/P1-C.md).
import type { GrupoDasn, TipoContato, TipoLancamento } from '@meifin/shared';

import { api } from '@/lib/api/client';

export interface CategoriaRef {
  id: string;
  nome: string;
  tipo: TipoLancamento;
  grupoDasn: GrupoDasn | null;
  cor: string | null;
  icone: string | null;
  padrao: boolean;
  sistema: boolean;
  ativo: boolean;
  ordem: number;
}

export interface ContatoRef {
  id: string;
  nome: string;
  tipo: TipoContato;
  documento: string | null;
  ativo: boolean;
}

export interface DasParametros {
  ano: number;
  salarioMinimo: number;
  aliquotaInssBp: number;
  aliquotaInssCaminhoneiroBp: number;
  icms: number;
  iss: number;
  limiteAnual: number;
  limiteMensalProporcional: number;
  toleranciaExcessoBp: number;
  diaVencimentoDas: number;
  dasnPrazoDia: number;
  dasnPrazoMes: number;
  alertasLimitePct: number[];
  /** true quando a API usou o ano mais próximo por falta de parâmetros do ano pedido. */
  desatualizado?: boolean;
}

export interface Lista<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

export const referenciasApi = {
  categorias: (tipo?: TipoLancamento) =>
    api.get<{ data: CategoriaRef[] }>('/categorias', { query: { tipo } }),
  contatos: (tipo?: TipoContato) =>
    api.get<Lista<ContatoRef>>('/contatos', { query: { tipo, pageSize: 200 } }),
  dasParametros: (ano: number) =>
    api.get<{ data: DasParametros }>('/obrigacoes/parametros', { query: { ano } }),
};
