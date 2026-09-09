// Query keys da feature "das" (obrigações). Convenção: [feature, recurso, ...parâmetros].
// Mutações de dinheiro de outras features invalidam ['obrigacoes'] inteiro.
export const obrigacoesKeys = {
  all: ['obrigacoes'] as const,
  das: (ano: number) => ['obrigacoes', 'das', ano] as const,
  dasn: (anoBase: number) => ['obrigacoes', 'dasn', anoBase] as const,
  limite: (ano: number) => ['obrigacoes', 'limite', ano] as const,
  alertas: () => ['obrigacoes', 'alertas'] as const,
  calendario: (de: string, ate: string) => ['obrigacoes', 'calendario', de, ate] as const,
};
