// Query keys da feature contas-bancarias. Convenção: [feature, recurso, ...parâmetros].
// A raiz ['contas-bancarias'] entra nas listas de invalidação dos helpers financeiros
// (features/lancamentos/invalidate.ts e features/contas/invalidate.ts): todo movimento de
// dinheiro muda o saldo de alguma conta.
import type { QueryParams } from '@/lib/api/query';

export const contasBancariasKeys = {
  all: ['contas-bancarias'] as const,
  listas: () => ['contas-bancarias', 'lista'] as const,
  lista: (params: QueryParams) => ['contas-bancarias', 'lista', params] as const,
  opcoes: () => ['contas-bancarias', 'opcoes'] as const,
  detalhe: (id: string) => ['contas-bancarias', 'detalhe', id] as const,
  transferencias: (params: QueryParams) => ['contas-bancarias', 'transferencias', params] as const,
};
