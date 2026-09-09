// Regras de recorrências: CRUD + materialização idempotente das competências pendentes até o
// mês atual (seção 5 do plano). `gerarRecorrenciasPendentes(exec, tenantId, hoje)` é exportada
// para o dashboard (WP5) chamar antes de calcular previsões.
import {
  addMesesCompetencia,
  competenciaDe,
  competenciasEntre,
  diasNoMes,
  inicioMes,
  montarIsoDate,
  parseCompetencia,
  type AtualizarRecorrenciaBody,
  type Competencia,
  type CriarRecorrenciaBody,
  type GerarRecorrenciasBody,
  type GerarRecorrenciasResponse,
  type IsoDate,
  type ListarRecorrenciasQuery,
  type RecorrenciaDto,
} from '@meifin/shared';

import type { DbExecutor } from '../../db/index.js';
import type { RecorrenciaRow } from '../../db/schema/lancamentos.js';
import { NotFoundError, UnprocessableError } from '../../lib/errors.js';
import { isoTimestamp } from '../../lib/hoje.js';
import { forTenant, type TenantDb } from '../../lib/tenant-db.js';
import * as repoLanc from './repository.js';
import * as repo from './recorrencias.repository.js';

export function toRecorrenciaDto(r: repo.RecorrenciaComRefs): RecorrenciaDto {
  const rec = r.recorrencia;
  return {
    id: rec.id,
    tipo: rec.tipo,
    valor: rec.valor,
    descricao: rec.descricao,
    categoriaId: rec.categoriaId,
    categoria: r.categoria,
    contatoId: rec.contatoId,
    contato: r.contato,
    formaPagamento: rec.formaPagamento,
    diaDoMes: rec.diaDoMes,
    dataInicio: rec.dataInicio,
    dataFim: rec.dataFim,
    ativo: rec.ativo,
    ultimaCompetencia: rec.ultimaCompetencia ? rec.ultimaCompetencia.slice(0, 7) : null,
    createdAt: isoTimestamp(rec.createdAt) ?? rec.createdAt,
    updatedAt: isoTimestamp(rec.updatedAt) ?? rec.updatedAt,
  };
}

/** Categoria existe no tenant (404) e é do tipo informado (422); contato existe (404). */
export async function validarReferencias(
  tdb: TenantDb,
  tipo: RecorrenciaRow['tipo'],
  categoriaId: string,
  contatoId: string | null | undefined,
): Promise<void> {
  const categoria = await repoLanc.buscarCategoria(tdb, categoriaId);
  if (!categoria) throw new NotFoundError('Categoria não encontrada');
  if (categoria.tipo !== tipo) {
    throw new UnprocessableError(
      `A categoria "${categoria.nome}" é de ${categoria.tipo} e não pode receber uma ${tipo}`,
      [{ campo: 'categoriaId', mensagem: `Categoria de ${categoria.tipo}` }],
    );
  }
  if (contatoId) {
    const contato = await repoLanc.buscarContato(tdb, contatoId);
    if (!contato) throw new NotFoundError('Contato não encontrado');
  }
}

async function obterDto(tdb: TenantDb, id: string): Promise<RecorrenciaDto> {
  const linha = await repo.buscarComRefs(tdb, id);
  if (!linha) throw new NotFoundError('Recorrência não encontrada');
  return toRecorrenciaDto(linha);
}

export async function listar(
  tdb: TenantDb,
  query: ListarRecorrenciasQuery,
): Promise<RecorrenciaDto[]> {
  const linhas = await repo.listar(tdb, { tipo: query.tipo, ativo: query.ativo });
  return linhas.map(toRecorrenciaDto);
}

export function obter(tdb: TenantDb, id: string): Promise<RecorrenciaDto> {
  return obterDto(tdb, id);
}

/** Cria a recorrência e já materializa as competências pendentes até `hoje`. */
export async function criar(
  tdb: TenantDb,
  hoje: IsoDate,
  body: CriarRecorrenciaBody,
): Promise<RecorrenciaDto> {
  await validarReferencias(tdb, body.tipo, body.categoriaId, body.contatoId);
  const criada = await repo.criar(tdb, {
    tipo: body.tipo,
    valor: body.valor,
    descricao: body.descricao,
    categoriaId: body.categoriaId,
    contatoId: body.contatoId ?? null,
    formaPagamento: body.formaPagamento ?? 'pix',
    diaDoMes: body.diaDoMes,
    dataInicio: body.dataInicio,
    dataFim: body.dataFim ?? null,
    ativo: true,
    ultimaCompetencia: null,
  });
  await gerarRecorrenciasPendentes(tdb.exec, tdb.tenantId, hoje, { recorrenciaId: criada.id });
  return obterDto(tdb, criada.id);
}

export async function atualizar(
  tdb: TenantDb,
  hoje: IsoDate,
  id: string,
  body: AtualizarRecorrenciaBody,
): Promise<RecorrenciaDto> {
  const atual = await repo.buscar(tdb, id);
  const tipo = body.tipo ?? atual.tipo;
  const categoriaId = body.categoriaId ?? atual.categoriaId;
  const contatoId = body.contatoId !== undefined ? body.contatoId : atual.contatoId;
  if (body.tipo !== undefined || body.categoriaId !== undefined || body.contatoId) {
    await validarReferencias(tdb, tipo, categoriaId, contatoId);
  }
  const dataInicio = body.dataInicio ?? atual.dataInicio;
  const dataFim = body.dataFim !== undefined ? body.dataFim : atual.dataFim;
  if (dataFim && dataFim < dataInicio) {
    throw new UnprocessableError('Data final deve ser posterior à data inicial', [
      { campo: 'dataFim', mensagem: 'Data final deve ser posterior à data inicial' },
    ]);
  }

  await repo.atualizar(tdb, id, {
    tipo,
    categoriaId,
    contatoId,
    ...(body.valor !== undefined ? { valor: body.valor } : {}),
    ...(body.descricao !== undefined ? { descricao: body.descricao } : {}),
    ...(body.formaPagamento !== undefined ? { formaPagamento: body.formaPagamento ?? 'pix' } : {}),
    ...(body.diaDoMes !== undefined ? { diaDoMes: body.diaDoMes } : {}),
    dataInicio,
    dataFim,
    ...(body.ativo !== undefined ? { ativo: body.ativo } : {}),
  });
  // Reativar (ou estender a data final) materializa o que ficou pendente.
  await gerarRecorrenciasPendentes(tdb.exec, tdb.tenantId, hoje, { recorrenciaId: id });
  return obterDto(tdb, id);
}

export async function excluir(tdb: TenantDb, id: string): Promise<void> {
  // Desvincula antes de excluir (ver repoLanc.desvincularRecorrencia): o FK composto não pode
  // fazer isso sozinho sem tentar zerar tenant_id junto.
  await repoLanc.desvincularRecorrencia(tdb, id);
  await repo.excluir(tdb, id);
}

export function gerar(
  tdb: TenantDb,
  hoje: IsoDate,
  body: GerarRecorrenciasBody,
): Promise<GerarRecorrenciasResponse['data']> {
  return gerarRecorrenciasPendentes(tdb.exec, tdb.tenantId, hoje, body);
}

export interface OpcoesGeracao {
  /** Só esta recorrência (404 se não for do tenant). */
  recorrenciaId?: string;
  /** Competência limite AAAA-MM (padrão: mês de `hoje`). */
  ate?: Competencia;
}

function menorCompetencia(a: Competencia, b: Competencia): Competencia {
  return a <= b ? a : b;
}

/** Data do lançamento na competência: dia do mês com clamp no fim do mês, nunca antes do início. */
export function dataNaCompetencia(
  rec: Pick<RecorrenciaRow, 'diaDoMes' | 'dataInicio'>,
  comp: Competencia,
): IsoDate {
  const { ano, mes } = parseCompetencia(comp);
  const dia = Math.min(rec.diaDoMes, diasNoMes(ano, mes));
  const data = montarIsoDate({ ano, mes, dia });
  return data < rec.dataInicio ? rec.dataInicio : data;
}

/**
 * Materializa as competências pendentes das recorrências ativas do tenant até o mês de `hoje`
 * (ou `opcoes.ate`). Idempotente: INSERT … ON CONFLICT (recorrencia_id, competencia) DO NOTHING.
 * Pode ser chamada com `app.db` ou dentro de `withTx`. Usada pelo dashboard (WP5).
 */
export async function gerarRecorrenciasPendentes(
  exec: DbExecutor,
  tenantId: string,
  hoje: IsoDate,
  opcoes: OpcoesGeracao = {},
): Promise<GerarRecorrenciasResponse['data']> {
  const tdb = forTenant(exec, tenantId);
  const limite = opcoes.ate ?? competenciaDe(hoje);
  const lista = opcoes.recorrenciaId
    ? [await repo.buscar(tdb, opcoes.recorrenciaId)]
    : await repo.listarAtivas(tdb);

  let geradas = 0;
  let recorrenciasProcessadas = 0;
  const competencias = new Set<Competencia>();

  for (const rec of lista) {
    if (!rec.ativo) continue;
    const inicio = rec.ultimaCompetencia
      ? addMesesCompetencia(competenciaDe(rec.ultimaCompetencia), 1)
      : competenciaDe(rec.dataInicio);
    let fim = limite;
    if (rec.dataFim) fim = menorCompetencia(fim, competenciaDe(rec.dataFim));
    const pendentes = competenciasEntre(inicio, fim);
    if (pendentes.length === 0) continue;

    recorrenciasProcessadas += 1;
    const valores = pendentes
      .map((comp) => ({ competencia: inicioMes(comp), data: dataNaCompetencia(rec, comp) }))
      .filter((v) => !rec.dataFim || v.data <= rec.dataFim);
    const inseridos = await repo.materializar(tdb, rec, valores);
    geradas += inseridos.length;
    for (const i of inseridos) competencias.add(i.competencia.slice(0, 7));
    await repo.atualizar(tdb, rec.id, { ultimaCompetencia: inicioMes(fim) });
  }

  return {
    geradas,
    recorrencias: recorrenciasProcessadas,
    competencias: [...competencias].sort(),
  };
}
