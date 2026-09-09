// CONGELADO após o P1-B. Ponto único de criação/exclusão de lançamentos usado por outros
// módulos (títulos → baixa, obrigações → DAS, notas fiscais → receita, importações, recorrências).
// WP2 (lançamentos) implementa rotas/serviço no resto da pasta e deve chamar estas funções.
import { isIsoDate, type IsoDate } from '@meifin/shared';

import type { DbExecutor } from '../../db/index.js';
import { categorias } from '../../db/schema/categorias.js';
import { contatos } from '../../db/schema/contatos.js';
import { lancamentos, type LancamentoRow } from '../../db/schema/lancamentos.js';
import { NotFoundError, UnprocessableError, ValidationError } from '../../lib/errors.js';
import { forTenant } from '../../lib/tenant-db.js';

export interface CriarLancamentoInternoInput {
  tipo: LancamentoRow['tipo'];
  data: IsoDate;
  /** Centavos, inteiro > 0. */
  valor: number;
  descricao: string;
  categoriaId: string;
  contatoId?: string | null;
  formaPagamento: LancamentoRow['formaPagamento'];
  status: LancamentoRow['status'];
  /** Padrão: = data quando status = pago. */
  dataPagamento?: IsoDate | null;
  origem: LancamentoRow['origem'];
  parcelaId?: string | null;
  recorrenciaId?: string | null;
  /** AAAA-MM-01 (recorrência/DAS). */
  competencia?: IsoDate | null;
  importacaoId?: string | null;
  hashImportacao?: string | null;
  observacoes?: string | null;
}

/**
 * Cria um lançamento validando as regras de integridade multi-tenant:
 * - categoria existe no tenant (senão 404) e é do mesmo tipo (senão 422);
 * - contato, se informado, existe no tenant e não está excluído (senão 404);
 * - valor inteiro positivo em centavos, datas AAAA-MM-DD válidas;
 * - recorrência/importação são garantidas pela FK composta (erro → 422 pelo error handler).
 */
export async function criarLancamentoInterno(
  tx: DbExecutor,
  tenantId: string,
  input: CriarLancamentoInternoInput,
): Promise<LancamentoRow> {
  const detalhes: { campo: string; mensagem: string }[] = [];
  if (!Number.isInteger(input.valor) || input.valor <= 0) {
    detalhes.push({ campo: 'valor', mensagem: 'Valor deve ser um inteiro positivo em centavos' });
  }
  if (!isIsoDate(input.data)) detalhes.push({ campo: 'data', mensagem: 'Data inválida' });
  if (input.dataPagamento && !isIsoDate(input.dataPagamento)) {
    detalhes.push({ campo: 'dataPagamento', mensagem: 'Data de pagamento inválida' });
  }
  if (input.competencia && !isIsoDate(input.competencia)) {
    detalhes.push({ campo: 'competencia', mensagem: 'Competência inválida' });
  }
  const descricao = input.descricao?.trim() ?? '';
  if (descricao.length === 0)
    detalhes.push({ campo: 'descricao', mensagem: 'Informe a descrição' });
  if (detalhes.length > 0) throw new ValidationError('Dados inválidos', detalhes);

  const tdb = forTenant(tx, tenantId);

  const categoria = await tdb.findByIdOrNull(categorias, input.categoriaId);
  if (!categoria) throw new NotFoundError('Categoria não encontrada');
  if (categoria.tipo !== input.tipo) {
    throw new UnprocessableError(
      `A categoria "${categoria.nome}" é de ${categoria.tipo} e não pode receber uma ${input.tipo}`,
      [{ campo: 'categoriaId', mensagem: `Categoria de ${categoria.tipo}` }],
    );
  }

  if (input.contatoId) {
    const contato = await tdb.findByIdOrNull(contatos, input.contatoId);
    if (!contato) throw new NotFoundError('Contato não encontrado');
  }

  const dataPagamento =
    input.status === 'pago' ? (input.dataPagamento ?? input.data) : (input.dataPagamento ?? null);

  return tdb.insert(lancamentos, {
    tipo: input.tipo,
    data: input.data,
    valor: input.valor,
    descricao,
    categoriaId: categoria.id,
    contatoId: input.contatoId ?? null,
    formaPagamento: input.formaPagamento,
    status: input.status,
    dataPagamento,
    origem: input.origem,
    parcelaId: input.parcelaId ?? null,
    recorrenciaId: input.recorrenciaId ?? null,
    competencia: input.competencia ?? null,
    importacaoId: input.importacaoId ?? null,
    hashImportacao: input.hashImportacao ?? null,
    observacoes: input.observacoes?.trim() || null,
  });
}

/** Soft delete (deleted_at = now()) dentro do tenant; inexistente ou de outro tenant → 404. */
export async function excluirLancamentoInterno(
  tx: DbExecutor,
  tenantId: string,
  id: string,
): Promise<void> {
  await forTenant(tx, tenantId).softDelete(lancamentos, id);
}
