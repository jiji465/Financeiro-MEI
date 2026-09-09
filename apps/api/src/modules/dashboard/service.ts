// Regras do dashboard: períodos padrão (mês atual), comparação com o período anterior,
// fluxo de caixa (domínio agruparPorPeriodo), agregados por categoria/contato e comparativo
// mensal. Regras legais (limite, DAS) vêm de @meifin/shared/domain — nunca reimplementadas.
import {
  addDias,
  addMesesCompetencia,
  agruparPorPeriodo,
  calcularDas,
  competenciaDe,
  competenciasDevidas,
  competenciasEntre,
  diasEntre,
  fimMes,
  formatMesAno,
  inicioMes,
  type IsoDate,
  parseIsoDate,
  percentualDe,
  type ResumoDashboardDto,
  type FluxoCaixaDto,
  type PorCategoriaDto,
  type PorContatoDto,
  type ComparativoMensalDto,
  type SituacaoLimite,
  selecionarParametros,
  situacaoLimite,
  statusDas,
  variacaoPercentual,
  vencimentoDas,
} from '@meifin/shared';

import type { TenantDb } from '../../lib/tenant-db.js';
import * as repo from './repository.js';

export interface PeriodoResolvido {
  de: IsoDate;
  ate: IsoDate;
}

/** Período informado ou o mês civil de `hoje`. */
export function resolverPeriodo(
  query: { de?: string; ate?: string },
  hoje: IsoDate,
): PeriodoResolvido {
  const de = query.de ?? (query.ate ? inicioMes(query.ate) : inicioMes(hoje));
  const ate = query.ate ?? (query.de ? fimMes(query.de) : fimMes(hoje));
  return { de, ate };
}

/** Período imediatamente anterior com a mesma duração (em dias). */
export function periodoAnterior(p: PeriodoResolvido): PeriodoResolvido {
  const dias = diasEntre(p.de, p.ate) + 1;
  const ate = addDias(p.de, -1);
  return { de: addDias(ate, -(dias - 1)), ate };
}

function indicador(valor: number, anterior: number) {
  return { valor, anterior, variacao: variacaoPercentual(valor, anterior) };
}

/** Situação do limite anual do MEI (null quando não há parâmetros para o ano). */
export async function situacaoLimiteDoTenant(
  tdb: TenantDb,
  ctx: repo.ContextoTenant,
  ano: number,
  hoje: IsoDate,
): Promise<SituacaoLimite | null> {
  const selecionado = selecionarParametros(ctx.parametros, ano);
  if (!selecionado) return null;
  const acumulado = await repo.acumuladoReceitasAno(tdb, ano, ctx.configuracoes.regimeApuracao);
  return situacaoLimite({
    ano,
    params: selecionado.parametros,
    dataAbertura: ctx.tenant.dataAbertura,
    hoje,
    acumulado,
  });
}

const LIMITE_VENCIMENTOS = 8;
const DIAS_VENCIMENTOS = 30;

async function proximosVencimentos(
  tdb: TenantDb,
  ctx: repo.ContextoTenant,
  hoje: IsoDate,
): Promise<ResumoDashboardDto['proximosVencimentos']> {
  const ate = addDias(hoje, DIAS_VENCIMENTOS);
  const itens: ResumoDashboardDto['proximosVencimentos'] = [];

  // DAS: competências devidas do ano corrente (e do anterior, para atrasados) sem pagamento.
  const anoAtual = parseIsoDate(hoje).ano;
  const anos = [anoAtual - 1, anoAtual];
  for (const ano of anos) {
    const selecionado = selecionarParametros(ctx.parametros, ano);
    if (!selecionado) continue;
    const pagas = new Set((await repo.dasPagosDoAno(tdb, ano)).map((d) => d.competencia));
    const devidas = competenciasDevidas({ ano, dataAbertura: ctx.tenant.dataAbertura, hoje });
    const valor = calcularDas(
      selecionado.parametros,
      ctx.tenant.atividade,
      ctx.tenant.caminhoneiroTributos,
    ).total;
    for (const competencia of devidas) {
      if (pagas.has(competencia)) continue;
      const vencimento = vencimentoDas(competencia, selecionado.parametros.diaVencimentoDas);
      const status = statusDas({ competencia, vencimento, pago: false, hoje });
      if (status === 'futuro') continue;
      if (vencimento > ate) continue;
      itens.push({
        data: vencimento,
        tipo: 'das',
        titulo: `DAS ${formatMesAno(competencia, true)}`,
        valor,
        atrasado: status === 'atrasado',
        referenciaId: null,
        competencia,
      });
    }
  }

  const parcelas = await repo.parcelasProximas(tdb, ate, LIMITE_VENCIMENTOS);
  for (const p of parcelas) {
    const sufixo = p.numeroParcelas > 1 ? ` (${p.numero}/${p.numeroParcelas})` : '';
    itens.push({
      data: p.vencimento,
      tipo: p.tipo === 'pagar' ? 'parcela_pagar' : 'parcela_receber',
      titulo: `${p.descricao}${sufixo}${p.contato ? ` — ${p.contato}` : ''}`,
      valor: p.valor,
      atrasado: p.vencimento < hoje,
      referenciaId: p.parcelaId,
      competencia: null,
    });
  }

  return itens
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
    .slice(0, LIMITE_VENCIMENTOS);
}

export async function resumo(
  tdb: TenantDb,
  query: { de?: string; ate?: string },
  hoje: IsoDate,
): Promise<ResumoDashboardDto> {
  const periodo = resolverPeriodo(query, hoje);
  const anterior = periodoAnterior(periodo);
  const ctx = await repo.contextoTenant(tdb.exec, tdb.tenantId);

  const [atual, antes, pendentes, parcelasAbertas, quantidade, limite, vencimentos] =
    await Promise.all([
      repo.totaisPorTipo(tdb, { ...periodo, status: 'pago' }),
      repo.totaisPorTipo(tdb, { ...anterior, status: 'pago' }),
      repo.totaisPorTipo(tdb, { ...periodo, status: 'pendente' }),
      repo.parcelasAbertasPorTipo(tdb, periodo.de, periodo.ate),
      repo.contarLancamentos(tdb, periodo.de, periodo.ate),
      situacaoLimiteDoTenant(tdb, ctx, parseIsoDate(periodo.ate).ano, hoje),
      proximosVencimentos(tdb, ctx, hoje),
    ]);

  const saldo = atual.receitas - atual.despesas;
  const saldoAnterior = antes.receitas - antes.despesas;
  const receitasPendentes = pendentes.receitas + parcelasAbertas.receber;
  const despesasPendentes = pendentes.despesas + parcelasAbertas.pagar;

  return {
    periodo,
    receitas: indicador(atual.receitas, antes.receitas),
    despesas: indicador(atual.despesas, antes.despesas),
    saldo: indicador(saldo, saldoAnterior),
    receitasPendentes,
    despesasPendentes,
    saldoPrevisto: saldo + receitasPendentes - despesasPendentes,
    quantidadeLancamentos: quantidade,
    limite,
    proximosVencimentos: vencimentos,
  };
}

export async function fluxoCaixa(
  tdb: TenantDb,
  query: {
    de?: string;
    ate?: string;
    agrupamento: 'dia' | 'semana' | 'mes';
    incluirPrevisao: boolean;
  },
  hoje: IsoDate,
): Promise<FluxoCaixaDto> {
  const periodo = resolverPeriodo(query, hoje);
  const [saldoInicial, lancs, parcs] = await Promise.all([
    repo.saldoAntes(tdb, periodo.de),
    repo.itensFluxoLancamentos(tdb, periodo.de, periodo.ate),
    query.incluirPrevisao ? repo.itensFluxoParcelas(tdb, periodo.ate) : Promise.resolve([]),
  ]);
  const periodos = agruparPorPeriodo([...lancs, ...parcs], {
    de: periodo.de,
    ate: periodo.ate,
    agrupamento: query.agrupamento,
    saldoInicial,
    hoje,
    incluirPrevisao: query.incluirPrevisao,
  });
  const ultimo = periodos.at(-1);
  return {
    periodo,
    agrupamento: query.agrupamento,
    saldoInicial,
    periodos,
    saldoFinal: ultimo?.saldoAcumulado ?? saldoInicial,
    saldoProjetado: ultimo?.saldoProjetado ?? saldoInicial,
  };
}

const OUTRAS = 'Outras';
const SEM_CONTATO = 'Sem contato';

export async function porCategoria(
  tdb: TenantDb,
  query: {
    de?: string;
    ate?: string;
    tipo: 'receita' | 'despesa';
    somentePagos: boolean;
    limite: number;
  },
  hoje: IsoDate,
): Promise<PorCategoriaDto> {
  const periodo = resolverPeriodo(query, hoje);
  const linhas = await repo.somarPorCategoria(tdb, {
    ...periodo,
    tipo: query.tipo,
    somentePagos: query.somentePagos,
  });
  const total = linhas.reduce((s, l) => s + l.valor, 0);
  const principais = linhas.slice(0, query.limite);
  const resto = linhas.slice(query.limite);
  const itens: PorCategoriaDto['itens'] = principais.map((l) => ({
    categoriaId: l.categoriaId as string | null,
    nome: l.nome,
    cor: l.cor,
    icone: l.icone,
    valor: l.valor,
    percentual: percentualDe(l.valor, total),
    quantidade: l.quantidade,
  }));
  if (resto.length > 0) {
    const valor = resto.reduce((s, l) => s + l.valor, 0);
    itens.push({
      categoriaId: null,
      nome: OUTRAS,
      cor: null,
      icone: null,
      valor,
      percentual: percentualDe(valor, total),
      quantidade: resto.reduce((s, l) => s + l.quantidade, 0),
    });
  }
  return { periodo, tipo: query.tipo, total, itens };
}

export async function porContato(
  tdb: TenantDb,
  query: {
    de?: string;
    ate?: string;
    tipo: 'receita' | 'despesa';
    somentePagos: boolean;
    limite: number;
  },
  hoje: IsoDate,
): Promise<PorContatoDto> {
  const periodo = resolverPeriodo(query, hoje);
  const linhas = await repo.somarPorContato(tdb, {
    ...periodo,
    tipo: query.tipo,
    somentePagos: query.somentePagos,
  });
  const total = linhas.reduce((s, l) => s + l.valor, 0);
  const principais = linhas.slice(0, query.limite);
  const resto = linhas.slice(query.limite);
  const itens: PorContatoDto['itens'] = principais.map((l) => ({
    contatoId: l.contatoId,
    nome: l.contatoId ? (l.nome ?? SEM_CONTATO) : SEM_CONTATO,
    valor: l.valor,
    percentual: percentualDe(l.valor, total),
    quantidade: l.quantidade,
  }));
  if (resto.length > 0) {
    const valor = resto.reduce((s, l) => s + l.valor, 0);
    itens.push({
      contatoId: null,
      nome: OUTRAS,
      valor,
      percentual: percentualDe(valor, total),
      quantidade: resto.reduce((s, l) => s + l.quantidade, 0),
    });
  }
  return { periodo, tipo: query.tipo, total, itens };
}

export async function comparativoMensal(
  tdb: TenantDb,
  query: { meses: number; ate?: string },
  hoje: IsoDate,
): Promise<ComparativoMensalDto> {
  const ultima = query.ate ?? competenciaDe(hoje);
  const primeira = addMesesCompetencia(ultima, -(query.meses - 1));
  const linhas = await repo.somarPorMes(tdb, inicioMes(primeira), fimMes(ultima));
  const mapa = new Map<
    string,
    { receitas: number; despesas: number; receitasPendentes: number; despesasPendentes: number }
  >();
  for (const c of competenciasEntre(primeira, ultima)) {
    mapa.set(c, { receitas: 0, despesas: 0, receitasPendentes: 0, despesasPendentes: 0 });
  }
  for (const l of linhas) {
    const acc = mapa.get(l.competencia);
    if (!acc) continue;
    if (l.status === 'pago') {
      if (l.tipo === 'receita') acc.receitas += l.total;
      else acc.despesas += l.total;
    } else if (l.tipo === 'receita') acc.receitasPendentes += l.total;
    else acc.despesasPendentes += l.total;
  }
  const meses = [...mapa.entries()].map(([competencia, v]) => ({
    competencia,
    ...v,
    saldo: v.receitas - v.despesas,
  }));
  const totais = meses.reduce(
    (acc, m) => ({
      receitas: acc.receitas + m.receitas,
      despesas: acc.despesas + m.despesas,
      saldo: acc.saldo + m.saldo,
    }),
    { receitas: 0, despesas: 0, saldo: 0 },
  );
  const n = meses.length || 1;
  const media = (v: number) => Math.round(v / n);
  return {
    meses,
    medias: {
      receitas: media(totais.receitas),
      despesas: media(totais.despesas),
      saldo: media(totais.saldo),
    },
    totais,
  };
}
