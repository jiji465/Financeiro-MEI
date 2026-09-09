// Regras de UI derivadas da origem do lançamento (mesma lógica do service.atualizar/excluir da API).
import type { LancamentoDto } from '@meifin/shared';

/** Lançamento controlado por outro módulo: só descrição/observações podem mudar aqui. */
export function origemRestrita(lancamento: Pick<LancamentoDto, 'origem'>): boolean {
  return lancamento.origem === 'das' || lancamento.origem === 'baixa';
}

/** Exclusão bloqueada: vinculado a parcela (baixa) ou é um pagamento de DAS. */
export function exclusaoBloqueada(
  lancamento: Pick<LancamentoDto, 'origem' | 'parcelaId'>,
): boolean {
  return Boolean(lancamento.parcelaId) || lancamento.origem === 'das';
}
