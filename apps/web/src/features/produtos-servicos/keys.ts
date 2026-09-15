// Query keys da feature produtos-servicos. Convenção: [feature, recurso, ...parâmetros].
// A raiz ['produtos-servicos'] entra nas listas de invalidação dos helpers financeiros
// (features/lancamentos/invalidate.ts e features/contas/invalidate.ts): a contagem de uso de cada
// item do catálogo muda quando um lançamento com itens é criado, editado ou excluído.
import type { QueryParams } from '@/lib/api/query';

export const produtosServicosKeys = {
  all: ['produtos-servicos'] as const,
  listas: () => ['produtos-servicos', 'lista'] as const,
  lista: (params: QueryParams) => ['produtos-servicos', 'lista', params] as const,
  opcoes: () => ['produtos-servicos', 'opcoes'] as const,
  detalhe: (id: string) => ['produtos-servicos', 'detalhe', id] as const,
};
