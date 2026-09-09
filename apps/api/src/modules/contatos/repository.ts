// Acesso a dados de contatos (clientes e fornecedores). Único lugar do módulo que chama
// select/insert/update/delete. Soft delete via deleted_at (forTenant filtra automaticamente).
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm';

import { categorias } from '../../db/schema/categorias.js';
import { contatos, type ContatoRow } from '../../db/schema/contatos.js';
import { lancamentos, type LancamentoRow } from '../../db/schema/lancamentos.js';
import { notasFiscais } from '../../db/schema/notas-fiscais.js';
import { parcelas, titulos } from '../../db/schema/titulos.js';
import type { Paginacao } from '../../lib/pagination.js';
import { offsetDe } from '../../lib/pagination.js';
import type { TenantDb } from '../../lib/tenant-db.js';

export interface FiltroContatos {
  /** cliente → cliente + ambos; fornecedor → fornecedor + ambos; ambos → só ambos. */
  tipo?: ContatoRow['tipo'];
  /** true = só ativos (padrão); false = só inativos. */
  ativo?: boolean;
  /** Busca em nome, documento e e-mail (ILIKE). */
  busca?: string;
  ordenarPor?: 'nome' | 'createdAt';
  ordem?: 'asc' | 'desc';
}

function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function condicaoTipo(tipo: ContatoRow['tipo']) {
  if (tipo === 'ambos') return eq(contatos.tipo, 'ambos');
  return inArray(contatos.tipo, [tipo, 'ambos']);
}

function condicaoBusca(busca: string) {
  const termo = `%${escaparLike(busca)}%`;
  const documento = `%${escaparLike(busca.replace(/[.\-/\s]/g, '').toUpperCase())}%`;
  return or(
    ilike(contatos.nome, termo),
    ilike(contatos.email, termo),
    ilike(contatos.documento, documento),
  );
}

function condicoesLista(tdb: TenantDb, filtro: FiltroContatos) {
  const condicoes = [tdb.scoped(contatos)];
  if (filtro.tipo) condicoes.push(condicaoTipo(filtro.tipo));
  condicoes.push(eq(contatos.ativo, filtro.ativo ?? true));
  if (filtro.busca) condicoes.push(condicaoBusca(filtro.busca)!);
  return and(...condicoes);
}

export async function listar(
  tdb: TenantDb,
  filtro: FiltroContatos,
  paginacao: Paginacao,
): Promise<{ linhas: ContatoRow[]; total: number }> {
  const where = condicoesLista(tdb, filtro);
  const direcao = filtro.ordem === 'desc' ? desc : asc;
  const coluna = filtro.ordenarPor === 'createdAt' ? contatos.createdAt : contatos.nome;

  const [linhas, [contagem]] = await Promise.all([
    tdb.exec
      .select()
      .from(contatos)
      .where(where)
      .orderBy(direcao(coluna), asc(contatos.id))
      .limit(paginacao.pageSize)
      .offset(offsetDe(paginacao)),
    tdb.exec.select({ n: tdb.countInt() }).from(contatos).where(where),
  ]);
  return { linhas, total: contagem?.n ?? 0 };
}

/** Lista enxuta para seletores: só ativos, ordenada por nome, sem paginação (máx. 500). */
export function opcoes(
  tdb: TenantDb,
  filtro: Pick<FiltroContatos, 'tipo' | 'busca'>,
): Promise<Pick<ContatoRow, 'id' | 'nome' | 'tipo' | 'documento'>[]> {
  return tdb.exec
    .select({
      id: contatos.id,
      nome: contatos.nome,
      tipo: contatos.tipo,
      documento: contatos.documento,
    })
    .from(contatos)
    .where(condicoesLista(tdb, { ...filtro, ativo: true }))
    .orderBy(asc(contatos.nome), asc(contatos.id))
    .limit(500);
}

export function buscar(tdb: TenantDb, id: string): Promise<ContatoRow> {
  return tdb.findById(contatos, id);
}

/** Contato (ativo ou inativo, não excluído) com o documento normalizado informado. */
export async function buscarPorDocumento(
  tdb: TenantDb,
  documento: string,
): Promise<ContatoRow | null> {
  const linhas = await tdb.exec
    .select()
    .from(contatos)
    .where(and(tdb.scoped(contatos), eq(contatos.documento, documento)))
    .limit(1);
  return linhas[0] ?? null;
}

export function criar(
  tdb: TenantDb,
  valores: Omit<typeof contatos.$inferInsert, 'tenantId' | 'id'>,
): Promise<ContatoRow> {
  return tdb.insert(contatos, valores);
}

export function atualizar(
  tdb: TenantDb,
  id: string,
  valores: Partial<Omit<typeof contatos.$inferInsert, 'tenantId' | 'id'>>,
): Promise<ContatoRow> {
  return tdb.update(contatos, id, valores);
}

export function excluir(tdb: TenantDb, id: string): Promise<void> {
  return tdb.softDelete(contatos, id);
}

// ---------------------------------------------------------------------------
// Histórico e resumo (lançamentos, parcelas e notas do contato)
// ---------------------------------------------------------------------------

export interface FiltroHistorico {
  de?: string;
  ate?: string;
}

export interface LinhaHistorico {
  lancamento: LancamentoRow;
  categoria: { id: string; nome: string; cor: string | null; icone: string | null } | null;
}

export interface TotaisHistorico {
  receitas: number;
  despesas: number;
}

function condicoesHistorico(tdb: TenantDb, contatoId: string, filtro: FiltroHistorico) {
  const condicoes = [tdb.scoped(lancamentos), eq(lancamentos.contatoId, contatoId)];
  if (filtro.de) condicoes.push(gte(lancamentos.data, filtro.de));
  if (filtro.ate) condicoes.push(lte(lancamentos.data, filtro.ate));
  return and(...condicoes);
}

export async function listarLancamentos(
  tdb: TenantDb,
  contatoId: string,
  filtro: FiltroHistorico,
  paginacao: Paginacao,
): Promise<{ linhas: LinhaHistorico[]; total: number; totais: TotaisHistorico }> {
  const where = condicoesHistorico(tdb, contatoId, filtro);
  const [linhas, [agregado]] = await Promise.all([
    tdb.exec
      .select({
        lancamento: lancamentos,
        categoria: {
          id: categorias.id,
          nome: categorias.nome,
          cor: categorias.cor,
          icone: categorias.icone,
        },
      })
      .from(lancamentos)
      .leftJoin(
        categorias,
        and(
          eq(categorias.tenantId, lancamentos.tenantId),
          eq(categorias.id, lancamentos.categoriaId),
        ),
      )
      .where(where)
      .orderBy(desc(lancamentos.data), desc(lancamentos.createdAt), asc(lancamentos.id))
      .limit(paginacao.pageSize)
      .offset(offsetDe(paginacao)),
    tdb.exec
      .select({
        total: tdb.countInt(),
        receitas: tdb.sumInt(
          sql`case when ${lancamentos.tipo} = 'receita' then ${lancamentos.valor} else 0 end`,
        ),
        despesas: tdb.sumInt(
          sql`case when ${lancamentos.tipo} = 'despesa' then ${lancamentos.valor} else 0 end`,
        ),
      })
      .from(lancamentos)
      .where(where),
  ]);
  return {
    linhas: linhas.map((l) => ({ lancamento: l.lancamento, categoria: l.categoria ?? null })),
    total: agregado?.total ?? 0,
    totais: { receitas: agregado?.receitas ?? 0, despesas: agregado?.despesas ?? 0 },
  };
}

export interface AgregadoLancamentos {
  quantidade: number;
  primeiro: string | null;
  ultimo: string | null;
  receitasPagas: number;
  despesasPagas: number;
  receitasPendentes: number;
  despesasPendentes: number;
  receitasAtrasadas: number;
  despesasAtrasadas: number;
}

/** Totais dos lançamentos (não excluídos) do contato. `hoje` define o que é atrasado. */
export async function agregarLancamentos(
  tdb: TenantDb,
  contatoId: string,
  hoje: string,
): Promise<AgregadoLancamentos> {
  const soma = (tipo: 'receita' | 'despesa', status: 'pago' | 'pendente') =>
    tdb.sumInt(
      sql`case when ${lancamentos.tipo} = ${tipo} and ${lancamentos.status} = ${status} then ${lancamentos.valor} else 0 end`,
    );
  const atrasado = (tipo: 'receita' | 'despesa') =>
    tdb.sumInt(
      sql`case when ${lancamentos.tipo} = ${tipo} and ${lancamentos.status} = 'pendente' and ${lancamentos.data} < ${hoje}::date then ${lancamentos.valor} else 0 end`,
    );
  const [linha] = await tdb.exec
    .select({
      quantidade: tdb.countInt(),
      primeiro: sql<string | null>`min(${lancamentos.data})::text`,
      ultimo: sql<string | null>`max(${lancamentos.data})::text`,
      receitasPagas: soma('receita', 'pago'),
      despesasPagas: soma('despesa', 'pago'),
      receitasPendentes: soma('receita', 'pendente'),
      despesasPendentes: soma('despesa', 'pendente'),
      receitasAtrasadas: atrasado('receita'),
      despesasAtrasadas: atrasado('despesa'),
    })
    .from(lancamentos)
    .where(and(tdb.scoped(lancamentos), eq(lancamentos.contatoId, contatoId)));
  return {
    quantidade: linha?.quantidade ?? 0,
    primeiro: linha?.primeiro ?? null,
    ultimo: linha?.ultimo ?? null,
    receitasPagas: linha?.receitasPagas ?? 0,
    despesasPagas: linha?.despesasPagas ?? 0,
    receitasPendentes: linha?.receitasPendentes ?? 0,
    despesasPendentes: linha?.despesasPendentes ?? 0,
    receitasAtrasadas: linha?.receitasAtrasadas ?? 0,
    despesasAtrasadas: linha?.despesasAtrasadas ?? 0,
  };
}

export interface AgregadoParcelas {
  aReceber: number;
  aPagar: number;
  atrasadoReceber: number;
  atrasadoPagar: number;
}

/** Parcelas em aberto dos títulos (não excluídos) do contato. */
export async function agregarParcelasAbertas(
  tdb: TenantDb,
  contatoId: string,
  hoje: string,
): Promise<AgregadoParcelas> {
  const abertas = and(
    eq(parcelas.tenantId, tdb.tenantId),
    eq(parcelas.status, 'aberta'),
    eq(titulos.contatoId, contatoId),
    isNull(titulos.deletedAt),
  );
  const somaTipo = (tipo: 'receber' | 'pagar') =>
    tdb.sumInt(sql`case when ${titulos.tipo} = ${tipo} then ${parcelas.valor} else 0 end`);
  const [total, atrasado] = await Promise.all([
    tdb.exec
      .select({ receber: somaTipo('receber'), pagar: somaTipo('pagar') })
      .from(parcelas)
      .innerJoin(
        titulos,
        and(eq(titulos.tenantId, parcelas.tenantId), eq(titulos.id, parcelas.tituloId)),
      )
      .where(abertas),
    tdb.exec
      .select({ receber: somaTipo('receber'), pagar: somaTipo('pagar') })
      .from(parcelas)
      .innerJoin(
        titulos,
        and(eq(titulos.tenantId, parcelas.tenantId), eq(titulos.id, parcelas.tituloId)),
      )
      .where(and(abertas, lt(parcelas.vencimento, hoje))),
  ]);
  return {
    aReceber: total[0]?.receber ?? 0,
    aPagar: total[0]?.pagar ?? 0,
    atrasadoReceber: atrasado[0]?.receber ?? 0,
    atrasadoPagar: atrasado[0]?.pagar ?? 0,
  };
}

/** Quantidade de notas fiscais (não excluídas) do contato. */
export async function contarNotasFiscais(tdb: TenantDb, contatoId: string): Promise<number> {
  const [linha] = await tdb.exec
    .select({ n: tdb.countInt() })
    .from(notasFiscais)
    .where(and(tdb.scoped(notasFiscais), eq(notasFiscais.contatoId, contatoId)));
  return linha?.n ?? 0;
}
