// Query keys da feature "configuracoes". Convenção: [feature, recurso, ...parâmetros].
export const configuracoesKeys = {
  all: ['configuracoes'] as const,
  atual: () => ['configuracoes', 'atual'] as const,
  categorias: (tipo?: string) => ['configuracoes', 'categorias', tipo ?? 'todas'] as const,
};
