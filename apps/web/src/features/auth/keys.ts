// Query keys da feature auth. Convenção: [feature, recurso, ...parâmetros].
export const authKeys = {
  all: ['auth'] as const,
  me: () => ['auth', 'me'] as const,
};
