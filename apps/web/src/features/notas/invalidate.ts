// Após qualquer mutação em notas fiscais (registrar, atualizar, cancelar, vincular) invalidamos
// as features que derivam dados de lançamentos/receitas. Helper local: não importamos de outras
// features.
import type { QueryClient } from '@tanstack/react-query';

const CHAVES_AFETADAS = [['notas'], ['lancamentos'], ['dashboard'], ['relatorios']] as const;

export function invalidarAposMutacaoNotas(queryClient: QueryClient): Promise<void> {
  return Promise.all(
    CHAVES_AFETADAS.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  ).then(() => undefined);
}
