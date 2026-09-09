// Query keys das referências compartilhadas (categorias, contatos, parâmetros DAS, MEI).
// Convenção: [feature, recurso, ...parâmetros]. As features de escrita invalidam
// `referenciasKeys.categorias()` / `.contatos()` após criar/editar.
export const referenciasKeys = {
  all: ['referencias'] as const,
  categorias: (tipo?: string) => ['referencias', 'categorias', tipo ?? 'todas'] as const,
  categoriasTodas: () => ['referencias', 'categorias'] as const,
  contatos: (tipo?: string) => ['referencias', 'contatos', tipo ?? 'todos'] as const,
  contatosTodos: () => ['referencias', 'contatos'] as const,
  dasParametros: (ano: number) => ['referencias', 'das-parametros', ano] as const,
};
