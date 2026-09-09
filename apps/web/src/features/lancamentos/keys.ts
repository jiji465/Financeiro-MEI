// Query keys da feature "lancamentos" (lançamentos + recorrências).
// Convenção: ['lancamentos'|'recorrencias', recurso, ...params].
import type {
  ListarLancamentosQuery,
  ListarRecorrenciasQuery,
  ResumoLancamentosQuery,
} from '@meifin/shared';

export const lancamentosKeys = {
  all: ['lancamentos'] as const,
  lista: (filtros: Partial<ListarLancamentosQuery>) => ['lancamentos', 'lista', filtros] as const,
  detalhe: (id: string) => ['lancamentos', 'detalhe', id] as const,
  resumo: (query: Partial<ResumoLancamentosQuery>) => ['lancamentos', 'resumo', query] as const,
};

export const recorrenciasKeys = {
  all: ['recorrencias'] as const,
  lista: (filtros: Partial<ListarRecorrenciasQuery>) => ['recorrencias', 'lista', filtros] as const,
  detalhe: (id: string) => ['recorrencias', 'detalhe', id] as const,
};
