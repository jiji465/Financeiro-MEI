// Query keys da feature "contas" (títulos + parcelas). Convenção: ['contas', recurso, ...params].
import type { ListarParcelasQuery, ListarTitulosQuery } from '@meifin/shared';

export const contasKeys = {
  all: ['contas'] as const,
  parcelas: (filtros: Partial<ListarParcelasQuery>) => ['contas', 'parcelas', filtros] as const,
  parcela: (id: string) => ['contas', 'parcela', id] as const,
  resumo: (dias: number) => ['contas', 'resumo', dias] as const,
  titulos: (filtros: Partial<ListarTitulosQuery>) => ['contas', 'titulos', filtros] as const,
  titulo: (id: string) => ['contas', 'titulo', id] as const,
};
