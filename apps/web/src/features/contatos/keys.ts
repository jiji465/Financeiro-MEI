// Query keys da feature contatos. Convenção: [feature, recurso, ...parâmetros].
// Mutations invalidam `contatosKeys.all` e `referenciasKeys.all` (comboboxes de outras features).
import type { QueryParams } from '@/lib/api/query';

export const contatosKeys = {
  all: ['contatos'] as const,
  listas: () => ['contatos', 'lista'] as const,
  lista: (params: QueryParams) => ['contatos', 'lista', params] as const,
  opcoes: (tipo?: string) => ['contatos', 'opcoes', tipo ?? 'todos'] as const,
  detalhe: (id: string) => ['contatos', 'detalhe', id] as const,
  resumo: (id: string) => ['contatos', 'resumo', id] as const,
  lancamentos: (id: string, params: QueryParams) =>
    ['contatos', 'lancamentos', id, params] as const,
};
