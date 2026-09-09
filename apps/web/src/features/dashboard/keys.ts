// Query keys do dashboard. Mutations de dinheiro em outras features invalidam ['dashboard'] inteiro.
export const dashboardKeys = {
  all: ['dashboard'] as const,
  resumo: (query: Record<string, unknown> = {}) => [...dashboardKeys.all, 'resumo', query] as const,
  fluxoCaixa: (query: Record<string, unknown> = {}) =>
    [...dashboardKeys.all, 'fluxo-caixa', query] as const,
  porCategoria: (query: Record<string, unknown> = {}) =>
    [...dashboardKeys.all, 'por-categoria', query] as const,
  porContato: (query: Record<string, unknown> = {}) =>
    [...dashboardKeys.all, 'por-contato', query] as const,
  comparativoMensal: (query: Record<string, unknown> = {}) =>
    [...dashboardKeys.all, 'comparativo-mensal', query] as const,
};
