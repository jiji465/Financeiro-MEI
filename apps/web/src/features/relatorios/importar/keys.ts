// Query keys da feature "relatorios/importar" (histórico de importações CSV).
import type { ListarImportacoesQuery } from '@meifin/shared';

export const importacoesKeys = {
  all: ['importacoes'] as const,
  lista: (filtros: Partial<ListarImportacoesQuery>) => ['importacoes', 'lista', filtros] as const,
  detalhe: (id: string) => ['importacoes', 'detalhe', id] as const,
};
