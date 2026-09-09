// Query keys dos relatórios (só as views em JSON; downloads não passam pelo cache do TanStack Query).
export const relatoriosKeys = {
  all: ['relatorios'] as const,
  dre: (query: Record<string, unknown> = {}) => [...relatoriosKeys.all, 'dre', query] as const,
  extrato: (query: Record<string, unknown> = {}) =>
    [...relatoriosKeys.all, 'extrato', query] as const,
  dasn: (query: Record<string, unknown> = {}) => [...relatoriosKeys.all, 'dasn', query] as const,
  limite: (query: Record<string, unknown> = {}) =>
    [...relatoriosKeys.all, 'limite', query] as const,
  contas: (query: Record<string, unknown> = {}) =>
    [...relatoriosKeys.all, 'contas', query] as const,
};
