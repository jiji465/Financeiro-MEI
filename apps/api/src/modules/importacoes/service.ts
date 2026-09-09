// Importação de CSV: preview (parse + interpretação + dedupe por hash + sugestão de categoria)
// e confirmação (cria lançamentos via core com origem "importacao"). Desfazer = soft delete.
import { createHash } from 'node:crypto';

import {
  parseCsvBrasileiro,
  parseDataBrasileira,
  parseNumeroBrasileiro,
  type ConfirmarImportacaoBody,
  type DesfazerImportacaoResponse,
  type FormaPagamento,
  type ImportacaoDto,
  type LinhaImportacaoDto,
  type ListaImportacoesResponse,
  type ListarImportacoesQuery,
  type MapeamentoCsv,
  type PreviewImportacaoDto,
  type StatusLancamento,
  type TipoLancamento,
} from '@meifin/shared';

import type { Database, DbExecutor } from '../../db/index.js';
import type { ImportacaoRow } from '../../db/schema/importacoes.js';
import { AppError, ConflictError } from '../../lib/errors.js';
import { isoTimestamp } from '../../lib/hoje.js';
import { parsePaginacao } from '../../lib/pagination.js';
import { forTenant, type TenantDb } from '../../lib/tenant-db.js';
import { criarLancamentoInterno, excluirLancamentoInterno } from '../lancamentos/core.js';
import * as repoLanc from '../lancamentos/repository.js';
import * as repo from './repository.js';

export interface ImportacoesCtx {
  tenantId: string;
  exec: DbExecutor;
  withTx: Database['withTx'];
}

export function toImportacaoDto(row: ImportacaoRow): ImportacaoDto {
  return {
    id: row.id,
    nomeArquivo: row.nomeArquivo,
    formato: row.formato,
    totalLinhas: row.totalLinhas,
    importadas: row.importadas,
    ignoradas: row.ignoradas,
    duplicadas: row.duplicadas,
    mapeamento: row.mapeamento as Record<string, unknown>,
    createdAt: isoTimestamp(row.createdAt) ?? row.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Interpretação (funções puras, testáveis sem banco)
// ---------------------------------------------------------------------------

export function normalizarTexto(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** sha256(tenant | data | valor | tipo | descrição normalizada) — chave de dedupe. */
export function hashLinha(
  tenantId: string,
  data: string,
  valor: number,
  tipo: TipoLancamento,
  descricao: string,
): string {
  return createHash('sha256')
    .update(`${tenantId}|${data}|${valor}|${tipo}|${normalizarTexto(descricao)}`)
    .digest('hex');
}

const TEXTO_RECEITA = new Set(['receita', 'receitas', 'credito', 'c', 'cr', 'entrada', 'r', '+']);
const TEXTO_DESPESA = new Set(['despesa', 'despesas', 'debito', 'd', 'db', 'saida', 's', '-']);

export function interpretarTipo(texto: string): TipoLancamento | null {
  const t = normalizarTexto(texto);
  if (TEXTO_RECEITA.has(t)) return 'receita';
  if (TEXTO_DESPESA.has(t)) return 'despesa';
  return null;
}

const FORMAS: [RegExp, FormaPagamento][] = [
  [/\bpix\b/, 'pix'],
  [/dinheiro|especie|cash/, 'dinheiro'],
  [/cart|credito|debito|visa|master|elo/, 'cartao'],
  [/boleto/, 'boleto'],
  [/transf|ted|doc\b|deposito/, 'transferencia'],
];

export function interpretarFormaPagamento(texto: string | undefined): FormaPagamento | null {
  const t = normalizarTexto(texto);
  if (!t) return null;
  for (const [re, forma] of FORMAS) if (re.test(t)) return forma;
  return 'outro';
}

export interface CategoriaRef {
  id: string;
  nome: string;
  tipo: TipoLancamento;
}

export interface ContatoRef {
  id: string;
  nome: string;
}

const PALAVRAS_IGNORADAS = new Set(['outras', 'outros', 'outra', 'outro', 'geral', 'diversos']);

/** Casa por nome exato (normalizado) ou sugere pela maior palavra do nome presente na descrição. */
export function sugerirCategoria(
  categorias: readonly CategoriaRef[],
  tipo: TipoLancamento,
  nomeColuna: string | undefined,
  descricao: string,
): CategoriaRef | null {
  const doTipo = categorias.filter((c) => c.tipo === tipo);
  const nome = normalizarTexto(nomeColuna);
  if (nome) {
    const exata = doTipo.find((c) => normalizarTexto(c.nome) === nome);
    if (exata) return exata;
  }
  const desc = normalizarTexto(descricao);
  if (!desc) return null;
  let melhor: { categoria: CategoriaRef; peso: number } | null = null;
  for (const categoria of doTipo) {
    const palavras = normalizarTexto(categoria.nome)
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length >= 4 && !PALAVRAS_IGNORADAS.has(p));
    for (const palavra of palavras) {
      if (desc.includes(palavra) && (!melhor || palavra.length > melhor.peso)) {
        melhor = { categoria, peso: palavra.length };
      }
    }
  }
  return melhor?.categoria ?? null;
}

export function casarContato(
  contatos: readonly ContatoRef[],
  nomeColuna: string | undefined,
): ContatoRef | null {
  const nome = normalizarTexto(nomeColuna);
  if (!nome) return null;
  return contatos.find((c) => normalizarTexto(c.nome) === nome) ?? null;
}

export interface ReferenciasInterpretacao {
  tenantId: string;
  categorias: readonly CategoriaRef[];
  contatos: readonly ContatoRef[];
}

export type LinhaInterpretada = Omit<LinhaImportacaoDto, 'duplicada'>;

/** Interpreta as linhas do CSV conforme o mapeamento (sem consultar o banco). */
export function interpretarCsv(
  texto: string,
  mapeamento: MapeamentoCsv,
  refs: ReferenciasInterpretacao,
): { delimitador: string; cabecalho: string[]; linhas: LinhaInterpretada[] } {
  const csv = parseCsvBrasileiro(texto);
  const errosParse = new Map<number, string>();
  for (const e of csv.erros)
    if (e.linha > 0 && !errosParse.has(e.linha)) errosParse.set(e.linha, e.mensagem);

  const padraoPor: Record<TipoLancamento, CategoriaRef | null> = {
    receita:
      refs.categorias.find(
        (c) => c.id === mapeamento.categoriaPadraoReceitaId && c.tipo === 'receita',
      ) ?? null,
    despesa:
      refs.categorias.find(
        (c) => c.id === mapeamento.categoriaPadraoDespesaId && c.tipo === 'despesa',
      ) ?? null,
  };

  const linhas: LinhaInterpretada[] = csv.linhas.map(({ numero, campos }) => {
    const col = (nome: string | undefined) => (nome ? (campos[nome] ?? '') : '');
    const erros: string[] = [];
    const erroParse = errosParse.get(numero);
    if (erroParse) erros.push(erroParse);

    const data = parseDataBrasileira(col(mapeamento.data));
    if (!data) erros.push('Data inválida');

    const bruto = parseNumeroBrasileiro(col(mapeamento.valor));
    if (bruto === null) erros.push('Valor inválido');
    else if (bruto === 0) erros.push('Valor zerado');
    const sinal = bruto !== null && mapeamento.inverterSinal ? -bruto : bruto;
    const valor = bruto !== null && bruto !== 0 ? Math.abs(bruto) : null;

    const descricao = col(mapeamento.descricao).trim();
    if (!descricao) erros.push('Descrição vazia');

    let tipo: TipoLancamento | null = null;
    if (mapeamento.modoTipo === 'fixo') tipo = mapeamento.tipoFixo ?? null;
    else if (mapeamento.modoTipo === 'coluna') tipo = interpretarTipo(col(mapeamento.tipo));
    else if (sinal !== null && sinal !== 0) tipo = sinal < 0 ? 'despesa' : 'receita';
    if (!tipo) erros.push('Tipo não identificado');

    const categoria = tipo
      ? (sugerirCategoria(
          refs.categorias,
          tipo,
          col(mapeamento.categoria) || undefined,
          descricao,
        ) ?? padraoPor[tipo])
      : null;
    const contato = casarContato(refs.contatos, col(mapeamento.contato) || undefined);
    const formaPagamento =
      interpretarFormaPagamento(col(mapeamento.formaPagamento) || undefined) ??
      mapeamento.formaPagamentoPadrao ??
      null;
    const observacoes = col(mapeamento.observacoes).trim() || null;
    const status: StatusLancamento = mapeamento.statusPadrao;

    const hash =
      data && valor !== null && tipo
        ? hashLinha(refs.tenantId, data, valor, tipo, descricao)
        : hashLinha(
            refs.tenantId,
            data ?? '',
            valor ?? 0,
            tipo ?? 'despesa',
            `${numero}:${descricao}`,
          );

    return {
      numero,
      data,
      valor,
      descricao,
      tipo,
      categoriaId: categoria?.id ?? null,
      categoriaNome: categoria?.nome ?? null,
      contatoId: contato?.id ?? null,
      contatoNome: contato?.nome ?? null,
      formaPagamento,
      status,
      observacoes,
      hash,
      erro: erros.length > 0 ? erros.join('; ') : null,
      bruto: campos,
    };
  });

  return { delimitador: csv.delimitador, cabecalho: csv.cabecalho, linhas };
}

/** Marca duplicadas: hash já existente no tenant ou repetido dentro do próprio arquivo. */
export function marcarDuplicadas(
  linhas: LinhaInterpretada[],
  existentes: ReadonlySet<string>,
): LinhaImportacaoDto[] {
  const vistos = new Set<string>();
  return linhas.map((l) => {
    const duplicada = !l.erro && (existentes.has(l.hash) || vistos.has(l.hash));
    if (!l.erro) vistos.add(l.hash);
    return { ...l, duplicada };
  });
}

/** Bytes do arquivo → texto: UTF-8 (com ou sem BOM) ou, se houver bytes inválidos, Latin-1. */
export function decodificarCsv(conteudo: Buffer): string {
  const utf8 = conteudo.toString('utf8');
  return utf8.includes('�') ? conteudo.toString('latin1') : utf8;
}

// ---------------------------------------------------------------------------
// Casos de uso
// ---------------------------------------------------------------------------

function tdbDe(ctx: ImportacoesCtx, exec: DbExecutor = ctx.exec): TenantDb {
  return forTenant(exec, ctx.tenantId);
}

export async function preview(
  ctx: ImportacoesCtx,
  nomeArquivo: string,
  conteudo: Buffer,
  mapeamento: MapeamentoCsv,
): Promise<PreviewImportacaoDto> {
  const tdb = tdbDe(ctx);
  const [categorias, contatos] = await Promise.all([
    repoLanc.listarCategoriasAtivas(tdb),
    repoLanc.listarContatosAtivos(tdb),
  ]);
  const interpretado = interpretarCsv(decodificarCsv(conteudo), mapeamento, {
    tenantId: ctx.tenantId,
    categorias,
    contatos,
  });
  const existentes = await repoLanc.hashesExistentes(
    tdb,
    interpretado.linhas.filter((l) => !l.erro).map((l) => l.hash),
  );
  const linhas = marcarDuplicadas(interpretado.linhas, existentes);
  const comErro = linhas.filter((l) => l.erro).length;
  const duplicadas = linhas.filter((l) => l.duplicada).length;
  return {
    nomeArquivo,
    delimitador: interpretado.delimitador,
    cabecalho: interpretado.cabecalho,
    totalLinhas: linhas.length,
    validas: linhas.length - comErro - duplicadas,
    comErro,
    duplicadas,
    linhas,
  };
}

export async function confirmar(
  ctx: ImportacoesCtx,
  body: ConfirmarImportacaoBody,
): Promise<ImportacaoDto> {
  const row = await ctx.withTx(async (tx) => {
    const tdb = tdbDe(ctx, tx);
    const importacao = await repo.criar(tdb, {
      nomeArquivo: body.nomeArquivo,
      formato: 'csv',
      totalLinhas: body.totalLinhas,
      mapeamento: body.mapeamento as unknown as Record<string, string | undefined>,
    });
    const existentes = await repoLanc.hashesExistentes(
      tdb,
      body.linhas.map((l) => l.hash),
    );
    const vistos = new Set<string>();
    let importadas = 0;
    let duplicadas = 0;

    for (const [indice, linha] of body.linhas.entries()) {
      if (existentes.has(linha.hash) || vistos.has(linha.hash)) {
        if (!body.ignorarDuplicadas) {
          throw new ConflictError(`Linha ${linha.numero}: lançamento já importado anteriormente`, [
            { campo: `linhas.${indice}.hash`, mensagem: 'Duplicada' },
          ]);
        }
        duplicadas += 1;
        continue;
      }
      vistos.add(linha.hash);
      try {
        await criarLancamentoInterno(tx, ctx.tenantId, {
          tipo: linha.tipo,
          data: linha.data,
          valor: linha.valor,
          descricao: linha.descricao,
          categoriaId: linha.categoriaId,
          contatoId: linha.contatoId ?? null,
          formaPagamento: linha.formaPagamento ?? body.mapeamento.formaPagamentoPadrao ?? 'pix',
          status: linha.status,
          observacoes: linha.observacoes ?? null,
          origem: 'importacao',
          importacaoId: importacao.id,
          hashImportacao: linha.hash,
        });
        importadas += 1;
      } catch (erro) {
        if (erro instanceof AppError) {
          throw new AppError(
            erro.code,
            `Linha ${linha.numero}: ${erro.message}`,
            (erro.details ?? [{ campo: 'linha', mensagem: erro.message }]).map((d) => ({
              campo: `linhas.${indice}.${d.campo}`,
              mensagem: d.mensagem,
            })),
            erro.status,
          );
        }
        throw erro;
      }
    }

    const ignoradas = Math.max(0, body.totalLinhas - importadas - duplicadas);
    return repo.atualizar(tdb, importacao.id, { importadas, ignoradas, duplicadas });
  });
  return toImportacaoDto(row);
}

export async function listar(
  ctx: ImportacoesCtx,
  query: ListarImportacoesQuery,
): Promise<ListaImportacoesResponse> {
  const { page, pageSize } = parsePaginacao(query);
  const { linhas, total } = await repo.listar(tdbDe(ctx), page, pageSize);
  return { data: linhas.map(toImportacaoDto), meta: { page, pageSize, total } };
}

export async function obter(ctx: ImportacoesCtx, id: string): Promise<ImportacaoDto> {
  return toImportacaoDto(await repo.buscar(tdbDe(ctx), id));
}

/** Desfaz: soft delete dos lançamentos criados e remove o registro da importação. */
export async function desfazer(
  ctx: ImportacoesCtx,
  id: string,
): Promise<DesfazerImportacaoResponse['data']> {
  return ctx.withTx(async (tx) => {
    const tdb = tdbDe(ctx, tx);
    await repo.buscar(tdb, id);
    const ids = await repoLanc.idsDaImportacao(tdb, id);
    for (const lancamentoId of ids) {
      await excluirLancamentoInterno(tx, ctx.tenantId, lancamentoId);
    }
    // Desvincula (mesmo os já soft-deletados acima) antes de excluir: o FK composto não pode
    // fazer isso sozinho sem tentar zerar tenant_id junto (ver repoLanc.desvincularImportacao).
    await repoLanc.desvincularImportacao(tdb, id);
    await repo.excluir(tdb, id);
    return { id, removidos: ids.length };
  });
}
