// Template de categorias aplicado no signup, filtrado pela atividade do MEI.
// A fonte é CATEGORIAS_PADRAO de @meifin/shared/constants (P1-A); aqui só materializamos as linhas.
// "Impostos e DAS" é categoria de sistema (indeletável) e vira configuracoes.categoria_das_id.
import { type Atividade, CATEGORIA_DAS_NOME, categoriasPadraoPara } from '@meifin/shared';

import type { DbExecutor } from '../index.js';
import { categorias, type CategoriaInsert, type CategoriaRow } from '../schema/categorias.js';

export const NOME_CATEGORIA_DAS = CATEGORIA_DAS_NOME;

/** Linhas (sem tenant) do template para a atividade. */
export function linhasCategoriasPadrao(atividade: Atividade): Omit<CategoriaInsert, 'tenantId'>[] {
  return categoriasPadraoPara(atividade).map((c) => ({
    nome: c.nome,
    tipo: c.tipo,
    grupoDasn: c.tipo === 'receita' ? c.grupoDasn : null,
    cor: c.cor,
    icone: c.icone,
    padrao: true,
    sistema: c.sistema,
    ativo: true,
    ordem: c.ordem,
  }));
}

/** Cria as categorias padrão do tenant (chamado no signup, dentro da transação). */
export async function aplicarCategoriasPadrao(
  tx: DbExecutor,
  tenantId: string,
  atividade: Atividade,
): Promise<CategoriaRow[]> {
  const valores = linhasCategoriasPadrao(atividade).map((c) => ({ ...c, tenantId }));
  return tx.insert(categorias).values(valores).returning();
}
