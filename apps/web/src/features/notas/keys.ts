// Query keys da feature "notas" (notas fiscais). Convenção: ['notas', recurso, ...params].
import type { ListarNotasFiscaisQuery } from '@meifin/shared';

export const notasKeys = {
  all: ['notas'] as const,
  lista: (filtros: Partial<ListarNotasFiscaisQuery>) => ['notas', 'lista', filtros] as const,
  item: (id: string) => ['notas', 'item', id] as const,
  resumo: (ano: number) => ['notas', 'resumo', ano] as const,
};
