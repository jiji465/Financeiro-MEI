// Relatórios em JSON (os exportadores CSV/PDF em exportar.ts recebem estes DTOs).
// Regras puras vêm de @meifin/shared/domain: montarDre, apurarFaturamento, janelaDasn,
// competenciasDevidas, situacaoLimite, diasEntre.
import {
  apurarFaturamento,
  type ContasRelatorioDto,
  competenciasDevidas,
  competenciasDoAno,
  type DasnRelatorioDto,
  dasPendentesDasn,
  diasEntre,
  type DreRelatorioDto,
  type ExtratoDto,
  type IsoDate,
  janelaDasn,
  type LimiteRelatorioDto,
  type LinhaContasDto,
  type LinhaExtratoDto,
  montarDre,
  parseIsoDate,
  percentualDe,
  type RegimeApuracao,
  selecionarParametros,
  situacaoLimite,
} from '@meifin/shared';

import { agoraIso } from '../../lib/hoje.js';
import type { TenantDb } from '../../lib/tenant-db.js';
import { resolverPeriodo, situacaoLimiteDoTenant } from '../dashboard/service.js';
import * as repo from './repository.js';

export type { ContextoTenant } from '../dashboard/repository.js';

export interface CabecalhoRelatorio {
  emissor: { nome: string; nomeFantasia: string | null; cnpj: string | null };
}

export async function cabecalho(tdb: TenantDb): Promise<CabecalhoRelatorio> {
  const ctx = await repo.contextoTenant(tdb.exec, tdb.tenantId);
  return {
    emissor: {
      nome: ctx.tenant.nome,
      nomeFantasia: ctx.tenant.nomeFantasia,
      cnpj: ctx.tenant.cnpj,
    },
  };
}

// ---------------------------------------------------------------------------
// DRE
// ---------------------------------------------------------------------------

export async function dre(
  tdb: TenantDb,
  query: { de?: string; ate?: string; regime?: RegimeApuracao },
  hoje: IsoDate,
): Promise<DreRelatorioDto> {
  const periodo = resolverPeriodo(query, hoje);
  const ctx = await repo.contextoTenant(tdb.exec, tdb.tenantId);
  const regime = query.regime ?? ctx.configuracoes.regimeApuracao;
  const linhas = await repo.linhasDre(tdb, { ...periodo, regime });
  const montada = montarDre(linhas);
  // montarDre conta 1 por linha; as linhas já vêm agregadas, então restauramos a quantidade real.
  const quantidades = new Map(
    linhas.map((l) => [`${l.tipo}:${l.categoriaId ?? ''}`, l.quantidade]),
  );
  const comQuantidade = (tipo: 'receita' | 'despesa', grupo: typeof montada.receitas) => ({
    total: grupo.total,
    itens: grupo.itens.map((i) => ({
      ...i,
      quantidade: quantidades.get(`${tipo}:${i.categoriaId ?? ''}`) ?? i.quantidade,
    })),
  });
  return {
    ...montada,
    receitas: comQuantidade('receita', montada.receitas),
    despesas: comQuantidade('despesa', montada.despesas),
    periodo,
    regime,
    geradoEm: agoraIso(),
  };
}

// ---------------------------------------------------------------------------
// Extrato
// ---------------------------------------------------------------------------

export async function extrato(
  tdb: TenantDb,
  query: {
    de?: string;
    ate?: string;
    tipo?: 'receita' | 'despesa';
    categoriaId?: string;
    contatoId?: string;
    somentePagos: boolean;
  },
  hoje: IsoDate,
): Promise<ExtratoDto> {
  const periodo = resolverPeriodo(query, hoje);
  const filtros = { tipo: query.tipo, categoriaId: query.categoriaId, contatoId: query.contatoId };
  const [saldoInicial, lancs] = await Promise.all([
    repo.saldoAnteriorExtrato(tdb, periodo.de, filtros),
    repo.listarLancamentos(tdb, {
      ...periodo,
      ...filtros,
      status: query.somentePagos ? 'pago' : undefined,
      ordenarPor: 'data',
      ordem: 'asc',
    }),
  ]);
  let saldo = saldoInicial;
  let receitas = 0;
  let despesas = 0;
  const linhas: LinhaExtratoDto[] = lancs.map((l) => {
    if (l.tipo === 'receita') {
      receitas += l.valor;
      saldo += l.valor;
    } else {
      despesas += l.valor;
      saldo -= l.valor;
    }
    return {
      id: l.id,
      data: l.data,
      descricao: l.descricao,
      tipo: l.tipo,
      categoria: l.categoria,
      contato: l.contato,
      formaPagamento: l.formaPagamento,
      status: l.status,
      origem: l.origem,
      valor: l.valor,
      saldo,
    };
  });
  return {
    periodo,
    saldoInicial,
    linhas,
    totais: { receitas, despesas, saldoFinal: saldo },
    geradoEm: agoraIso(),
  };
}

// ---------------------------------------------------------------------------
// DASN
// ---------------------------------------------------------------------------

export async function dasn(
  tdb: TenantDb,
  query: { ano?: number },
  hoje: IsoDate,
): Promise<DasnRelatorioDto> {
  const anoBase = query.ano ?? parseIsoDate(hoje).ano;
  const ctx = await repo.contextoTenant(tdb.exec, tdb.tenantId);
  const regime = ctx.configuracoes.regimeApuracao;
  const [porMesGrupo, pagos, declaracao, limite] = await Promise.all([
    repo.receitasPorMesEGrupo(tdb, anoBase, regime),
    repo.dasPagosDoAno(tdb, anoBase),
    repo.declaracaoDasn(tdb, anoBase),
    situacaoLimiteDoTenant(tdb, ctx, anoBase, hoje),
  ]);
  const faturamento = apurarFaturamento(
    porMesGrupo.map((r) => ({ valor: r.valor, grupoDasn: r.grupoDasn })),
  );
  const selecionado = selecionarParametros(ctx.parametros, anoBase);
  const janela = janelaDasn(anoBase, hoje, selecionado?.parametros);
  const devidas = competenciasDevidas({
    ano: anoBase,
    dataAbertura: ctx.tenant.dataAbertura,
    hoje,
  });
  const pagas = new Set(pagos.map((p) => p.competencia));
  const dasPendentes = dasPendentesDasn(devidas, [...pagas]);

  const porMes = competenciasDoAno(anoBase).map((competencia) => {
    const doMes = porMesGrupo.filter((r) => r.competencia === competencia);
    const soma = (grupo: 'comercio' | 'servicos' | null) =>
      doMes.filter((r) => r.grupoDasn === grupo).reduce((s, r) => s + r.valor, 0);
    const comercio = soma('comercio');
    const servicos = soma('servicos');
    const semGrupo = soma(null);
    return {
      competencia,
      comercio,
      servicos,
      semGrupo,
      total: comercio + servicos + semGrupo,
      dasPago: pagas.has(competencia),
    };
  });

  return {
    anoBase,
    faturamentoApurado: faturamento.total,
    receitaComercio: faturamento.comercio,
    receitaServicos: faturamento.servicos,
    receitaSemGrupo: faturamento.semGrupo,
    faturamentoDeclarado: declaracao?.faturamentoDeclarado ?? null,
    status: declaracao?.status ?? 'pendente',
    dataEntrega: declaracao?.dataEntrega ?? null,
    numeroRecibo: declaracao?.numeroRecibo ?? null,
    prazo: janela.prazo,
    janelaAberta: janela.aberta,
    atrasada: janela.atrasada && (declaracao?.status ?? 'pendente') !== 'entregue',
    diasParaPrazo: janela.diasParaPrazo,
    dasPendentes,
    alertaSemGrupo: faturamento.alertaSemGrupo,
    percentualLimite: limite?.percentual ?? 0,
    excesso: limite?.excesso ?? null,
    porMes,
    geradoEm: agoraIso(),
  };
}

// ---------------------------------------------------------------------------
// Limite anual
// ---------------------------------------------------------------------------

export async function limite(
  tdb: TenantDb,
  query: { ano?: number },
  hoje: IsoDate,
): Promise<LimiteRelatorioDto> {
  const ano = query.ano ?? parseIsoDate(hoje).ano;
  const ctx = await repo.contextoTenant(tdb.exec, tdb.tenantId);
  const regime = ctx.configuracoes.regimeApuracao;
  const selecionado = selecionarParametros(ctx.parametros, ano);
  const porMesGrupo = await repo.receitasPorMesEGrupo(tdb, ano, regime);
  const acumuladoTotal = porMesGrupo.reduce((s, r) => s + r.valor, 0);
  const params = selecionado?.parametros ?? {
    limiteAnual: 0,
    limiteMensalProporcional: 0,
    toleranciaExcessoBp: 0,
    alertasLimitePct: [70, 85, 100],
  };
  const situacao = situacaoLimite({
    ano,
    params,
    dataAbertura: ctx.tenant.dataAbertura,
    hoje,
    acumulado: acumuladoTotal,
  });
  let acumulado = 0;
  const porMes = competenciasDoAno(ano).map((competencia) => {
    const valor = porMesGrupo
      .filter((r) => r.competencia === competencia)
      .reduce((s, r) => s + r.valor, 0);
    acumulado += valor;
    return {
      competencia,
      valor,
      acumulado,
      percentualAcumulado: percentualDe(acumulado, situacao.limite),
    };
  });
  return {
    ...situacao,
    regime,
    porMes,
    marcas: [...params.alertasLimitePct],
    geradoEm: agoraIso(),
  };
}

// ---------------------------------------------------------------------------
// Lançamentos (exportação bruta)
// ---------------------------------------------------------------------------

export type LinhaLancamentoRelatorio = repo.LancamentoCompleto;

export async function lancamentos(
  tdb: TenantDb,
  query: repo.FiltroLancamentos,
): Promise<LinhaLancamentoRelatorio[]> {
  return repo.listarLancamentos(tdb, query);
}

// ---------------------------------------------------------------------------
// Contas (parcelas a pagar/receber)
// ---------------------------------------------------------------------------

export async function contas(
  tdb: TenantDb,
  query: {
    tipo?: 'pagar' | 'receber';
    status?: 'aberta' | 'paga' | 'cancelada';
    contatoId?: string;
    vencimentoDe?: string;
    vencimentoAte?: string;
    atrasadas?: boolean;
  },
  hoje: IsoDate,
): Promise<ContasRelatorioDto> {
  const parcelas = await repo.listarParcelas(tdb, { ...query, hoje });
  const totais: ContasRelatorioDto['totais'] = {
    pagar: { aberto: 0, atrasado: 0, pago: 0 },
    receber: { aberto: 0, atrasado: 0, pago: 0 },
  };
  const linhas: LinhaContasDto[] = parcelas.map((p) => {
    const atrasada = p.status === 'aberta' && p.vencimento < hoje;
    const diasAtraso = atrasada ? diasEntre(p.vencimento, hoje) : 0;
    const grupo = totais[p.tipo];
    if (p.status === 'paga') grupo.pago += p.valorPago ?? p.valor;
    else if (p.status === 'aberta') {
      grupo.aberto += p.valor;
      if (atrasada) grupo.atrasado += p.valor;
    }
    return {
      parcelaId: p.parcelaId,
      tituloId: p.tituloId,
      tipo: p.tipo,
      descricao: p.descricao,
      contato: p.contato,
      categoria: p.categoria,
      parcela: `${p.numero}/${p.numeroParcelas}`,
      vencimento: p.vencimento,
      valor: p.valor,
      status: p.status,
      dataPagamento: p.dataPagamento,
      valorPago: p.valorPago,
      atrasada,
      diasAtraso,
    };
  });
  return {
    filtros: {
      tipo: query.tipo ?? null,
      status: query.status ?? null,
      vencimentoDe: query.vencimentoDe ?? null,
      vencimentoAte: query.vencimentoAte ?? null,
    },
    linhas,
    totais,
    geradoEm: agoraIso(),
  };
}
