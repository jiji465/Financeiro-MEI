// Após qualquer mutação de dinheiro (criar/editar/excluir lançamento, pagar, anexo, recorrência,
// importação) invalidamos as features que derivam dados de lançamentos. Helper local: não
// importamos de outras features (ver docs/handoff/P1-C.md).
import type { QueryClient } from '@tanstack/react-query';

const CHAVES_AFETADAS = [
  ['lancamentos'],
  ['recorrencias'],
  ['contas'],
  ['dashboard'],
  ['relatorios'],
  ['obrigacoes'],
  ['contatos'],
  ['referencias'],
] as const;

export function invalidarAposMutacaoFinanceira(queryClient: QueryClient): Promise<void> {
  return Promise.all(
    CHAVES_AFETADAS.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  ).then(() => undefined);
}
