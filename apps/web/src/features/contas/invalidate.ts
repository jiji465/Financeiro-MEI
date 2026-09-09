// Após qualquer mutação de dinheiro (baixa, estorno, nova conta, cancelamento) invalidamos as
// features que derivam dados de lançamentos/parcelas. Helper local: não importamos de outras features.
import type { QueryClient } from '@tanstack/react-query';

const CHAVES_AFETADAS = [
  ['contas'],
  ['lancamentos'],
  ['dashboard'],
  ['relatorios'],
  ['obrigacoes'],
  ['contatos'],
  ['notas'],
] as const;

export function invalidarAposMutacaoFinanceira(queryClient: QueryClient): Promise<void> {
  return Promise.all(
    CHAVES_AFETADAS.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  ).then(() => undefined);
}
