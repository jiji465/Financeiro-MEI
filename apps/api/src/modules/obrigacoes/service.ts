// Regras das obrigações do MEI: parâmetros por ano (lookup exato → fallback), DAS mensal
// (valor, vencimento em dia útil, status, pagamento que gera despesa via lancamentos/core),
// DASN-SIMEI (apuração por grupo, DAS pendentes, janela), limite anual (regime das
// configurações), calendário e alertas. Toda regra pura vem de @meifin/shared/domain —
// aqui só juntamos dados do banco com as funções do domínio.
import {
  acumularReceitas,
  addDias,
  type Alerta,
  apurarFaturamento,
  calcularDas,
  type Competencia,
  competenciaDe,
  competenciasDevidas,
  competenciasDoAno,
  type ContextoAlertas,
  type DasCompetenciaDto,
  type DasnDto,
  type DasnParaAlerta,
  type DasPagamentoDto,
  type DasParaAlerta,
  type DetalhamentoDas,
  diasAtrasoDas,
  type EventoCalendarioDto,
  gerarAlertas,
  type IsoDate,
  janelaDasn,
  type LancamentoDto,
  type LimiteDto,
  mesInicial,
  type ParametrosMei,
  type ParcelasParaAlerta,
  parseIsoDate,
  percentualDe,
  type RegimeApuracao,
  type RegistrarPagamentoDasBody,
  type SalvarDasnBody,
  selecionarParametros,
  situacaoLimite,
  statusDas,
  vencimentoDas,
} from '@meifin/shared';

import type { DbExecutor } from '../../db/index.js';
import type { CategoriaRow } from '../../db/schema/categorias.js';
import type { LancamentoRow } from '../../db/schema/lancamentos.js';
import type { DasPagamentoRow } from '../../db/schema/obrigacoes.js';
import type { ParametrosMeiRow } from '../../db/schema/parametros.js';
import type { ConfiguracoesRow, TenantRow } from '../../db/schema/tenants.js';
import { ConflictError, NotFoundError, UnprocessableError } from '../../lib/errors.js';
import { isoTimestamp } from '../../lib/hoje.js';
import { forTenant } from '../../lib/tenant-db.js';
import { getCategoriaSistema } from '../categorias/core.js';
import { obter as obterTenantConfig } from '../configuracoes/repository.js';
import { criarLancamentoInterno, excluirLancamentoInterno } from '../lancamentos/core.js';
import * as repo from './repository.js';

// ---------------------------------------------------------------------------
// Parâmetros
// ---------------------------------------------------------------------------

export interface ParametrosSelecionadosDto {
  anoSolicitado: number;
  parametros: ParametrosMei;
  desatualizado: boolean;
  confirmar: boolean;
  origem: 'exato' | 'fallback';
}

function toParametrosMei(row: ParametrosMeiRow): ParametrosMei {
  return {
    ano: row.ano,
    salarioMinimo: row.salarioMinimo,
    aliquotaInssBp: row.aliquotaInssBp,
    aliquotaInssCaminhoneiroBp: row.aliquotaInssCaminhoneiroBp,
    icms: row.icms,
    iss: row.iss,
    limiteAnual: row.limiteAnual,
    limiteMensalProporcional: row.limiteMensalProporcional,
    toleranciaExcessoBp: row.toleranciaExcessoBp,
    diaVencimentoDas: row.diaVencimentoDas,
    dasnPrazoDia: row.dasnPrazoDia,
    dasnPrazoMes: row.dasnPrazoMes,
    alertasLimitePct: row.alertasLimitePct,
  };
}

/** Ano exato; senão o maior ano ≤ pedido (desatualizado=true); nenhum → 422. */
export async function obterParametros(
  exec: DbExecutor,
  ano: number,
): Promise<ParametrosSelecionadosDto> {
  const linhas = await repo.listarParametros(exec);
  const lista = linhas.map(toParametrosMei);
  const selecionado = selecionarParametros(lista, ano);
  if (!selecionado) {
    throw new UnprocessableError(
      `Não há parâmetros do MEI cadastrados para ${ano} nem para anos anteriores`,
    );
  }
  const linha = linhas.find((l) => l.ano === selecionado.parametros.ano);
  return {
    anoSolicitado: ano,
    parametros: selecionado.parametros,
    desatualizado: selecionado.desatualizado,
    confirmar: linha ? !linha.confirmado : false,
    origem: selecionado.desatualizado ? 'fallback' : 'exato',
  };
}

export interface ContextoTenant {
  tenant: TenantRow;
  configuracoes: ConfiguracoesRow;
}

function contextoTenant(exec: DbExecutor, tenantId: string): Promise<ContextoTenant> {
  return obterTenantConfig(exec, tenantId);
}

function anoDeHoje(hoje: IsoDate): number {
  return parseIsoDate(hoje).ano;
}

function dasDoTenant(params: ParametrosMei, tenant: TenantRow): DetalhamentoDas {
  return calcularDas(params, tenant.atividade, tenant.caminhoneiroTributos);
}

export async function parametrosComDas(exec: DbExecutor, tenantId: string, ano: number) {
  const [{ tenant }, sel] = await Promise.all([
    contextoTenant(exec, tenantId),
    obterParametros(exec, ano),
  ]);
  return { ...sel, dasMensal: dasDoTenant(sel.parametros, tenant) };
}

// ---------------------------------------------------------------------------
// DAS mensal
// ---------------------------------------------------------------------------

function toPagamentoDto(row: DasPagamentoRow): DasPagamentoDto {
  return {
    id: row.id,
    competencia: row.competencia.slice(0, 7),
    valorCalculado: row.valorCalculado,
    valorPago: row.valorPago,
    dataPagamento: row.dataPagamento,
    formaPagamento: row.formaPagamento,
    lancamentoId: row.lancamentoId,
    observacao: row.observacao,
    createdAt: isoTimestamp(row.createdAt) ?? row.createdAt,
  };
}

export interface DasAnoCalculado {
  ano: number;
  atividade: TenantRow['atividade'];
  caminhoneiroTributos: TenantRow['caminhoneiroTributos'];
  parametros: ParametrosMei;
  parametrosDesatualizados: boolean;
  competencias: DasCompetenciaDto[];
  totais: {
    devido: number;
    pago: number;
    pendente: number;
    atrasado: number;
    quantidadeAtrasadas: number;
  };
}

interface CalculoCompetenciaInput {
  competencia: Competencia;
  params: ParametrosMei;
  tenant: TenantRow;
  pagamento: DasPagamentoRow | null;
  /** true a partir do mês de abertura (inclui meses futuros do ano). */
  devida: boolean;
  hoje: IsoDate;
}

function calcularCompetencia({
  competencia,
  params,
  tenant,
  pagamento,
  devida,
  hoje,
}: CalculoCompetenciaInput): DasCompetenciaDto {
  const detalhamento = dasDoTenant(params, tenant);
  const vencimento = vencimentoDas(competencia, params.diaVencimentoDas);
  const pago = pagamento !== null;
  let status = statusDas({ competencia, vencimento, pago, hoje });
  if (!devida && !pago) status = competencia > competenciaDe(hoje) ? 'futuro' : 'pendente';
  return {
    competencia,
    devida,
    valor: detalhamento.total,
    detalhamento,
    vencimento,
    status,
    diasAtraso: status === 'atrasado' ? diasAtrasoDas(vencimento, hoje) : 0,
    pagamento: pagamento ? toPagamentoDto(pagamento) : null,
  };
}

/** Monta as 12 competências do ano com valor, vencimento, status e pagamento. */
export async function montarDasAno(
  exec: DbExecutor,
  tenantId: string,
  ano: number,
  hoje: IsoDate,
  ctx?: ContextoTenant,
): Promise<DasAnoCalculado> {
  const { tenant } = ctx ?? (await contextoTenant(exec, tenantId));
  const tdb = forTenant(exec, tenantId);
  const [sel, pagamentos] = await Promise.all([
    obterParametros(exec, ano),
    repo.listarPagamentosDoAno(tdb, ano),
  ]);
  const porCompetencia = new Map(pagamentos.map((p) => [p.competencia.slice(0, 7), p]));
  const inicio = mesInicial(ano, tenant.dataAbertura);
  const devidasAteHoje = new Set(
    competenciasDevidas({ ano, dataAbertura: tenant.dataAbertura, hoje }),
  );

  const competencias = competenciasDoAno(ano).map((competencia) => {
    const mes = Number(competencia.slice(5, 7));
    return calcularCompetencia({
      competencia,
      params: sel.parametros,
      tenant,
      pagamento: porCompetencia.get(competencia) ?? null,
      devida: inicio !== null && mes >= inicio,
      hoje,
    });
  });

  const totais = { devido: 0, pago: 0, pendente: 0, atrasado: 0, quantidadeAtrasadas: 0 };
  for (const c of competencias) {
    if (c.pagamento) totais.pago += c.pagamento.valorPago;
    if (!devidasAteHoje.has(c.competencia)) continue;
    totais.devido += c.valor;
    if (c.status === 'pendente') totais.pendente += c.valor;
    if (c.status === 'atrasado') {
      totais.atrasado += c.valor;
      totais.quantidadeAtrasadas += 1;
    }
  }

  return {
    ano,
    atividade: tenant.atividade,
    caminhoneiroTributos: tenant.caminhoneiroTributos,
    parametros: sel.parametros,
    parametrosDesatualizados: sel.desatualizado,
    competencias,
    totais,
  };
}

export async function obterCompetencia(
  exec: DbExecutor,
  tenantId: string,
  competencia: Competencia,
  hoje: IsoDate,
): Promise<DasCompetenciaDto> {
  const ano = Number(competencia.slice(0, 4));
  const dasAno = await montarDasAno(exec, tenantId, ano, hoje);
  const encontrada = dasAno.competencias.find((c) => c.competencia === competencia);
  if (!encontrada) throw new NotFoundError('Competência não encontrada');
  return encontrada;
}

function toLancamentoDto(row: LancamentoRow, categoria: CategoriaRow): LancamentoDto {
  return {
    id: row.id,
    tipo: row.tipo,
    data: row.data,
    valor: row.valor,
    descricao: row.descricao,
    categoriaId: row.categoriaId,
    categoria: {
      id: categoria.id,
      nome: categoria.nome,
      cor: categoria.cor,
      icone: categoria.icone,
    },
    contatoId: row.contatoId,
    contato: null,
    formaPagamento: row.formaPagamento,
    status: row.status,
    dataPagamento: row.dataPagamento,
    observacoes: row.observacoes,
    anexo:
      row.anexoPath && row.anexoNome && row.anexoMime
        ? { nome: row.anexoNome, mime: row.anexoMime, tamanho: row.anexoTamanho ?? 0 }
        : null,
    origem: row.origem,
    recorrenciaId: row.recorrenciaId,
    competencia: row.competencia ? row.competencia.slice(0, 7) : null,
    parcelaId: row.parcelaId,
    importacaoId: row.importacaoId,
    createdAt: isoTimestamp(row.createdAt) ?? row.createdAt,
    updatedAt: isoTimestamp(row.updatedAt) ?? row.updatedAt,
  };
}

function descricaoDas(competencia: Competencia): string {
  const [ano, mes] = competencia.split('-');
  return `DAS MEI ${mes}/${ano}`;
}

/** Deve rodar em transação: grava das_pagamentos e a despesa (origem das) juntas. */
export async function registrarPagamento(
  tx: DbExecutor,
  tenantId: string,
  competencia: Competencia,
  body: RegistrarPagamentoDasBody,
  hoje: IsoDate,
): Promise<{ competencia: DasCompetenciaDto; lancamento: LancamentoDto }> {
  const tdb = forTenant(tx, tenantId);
  const ctx = await contextoTenant(tx, tenantId);
  const ano = Number(competencia.slice(0, 4));

  if (competencia > competenciaDe(hoje)) {
    throw new UnprocessableError('O DAS de uma competência futura ainda não pode ser registrado', [
      { campo: 'competencia', mensagem: 'Competência futura' },
    ]);
  }
  const inicio = mesInicial(ano, ctx.tenant.dataAbertura);
  if (inicio === null || Number(competencia.slice(5, 7)) < inicio) {
    throw new UnprocessableError('Essa competência é anterior à data de abertura do MEI', [
      { campo: 'competencia', mensagem: 'Anterior à abertura do MEI' },
    ]);
  }

  const existente = await repo.buscarPagamento(tdb, competencia);
  if (existente) {
    throw new ConflictError(`O DAS de ${competencia.slice(5, 7)}/${ano} já está marcado como pago`);
  }

  const sel = await obterParametros(tx, ano);
  const calculado = calcularCompetencia({
    competencia,
    params: sel.parametros,
    tenant: ctx.tenant,
    pagamento: null,
    devida: true,
    hoje,
  });

  const dataPagamento = body.dataPagamento ?? hoje;
  const valorPago = body.valorPago ?? calculado.valor;
  const formaPagamento = body.formaPagamento ?? 'pix';
  const categoria = await getCategoriaSistema(tx, tenantId, 'das');

  const lancamento = await criarLancamentoInterno(tx, tenantId, {
    tipo: 'despesa',
    data: dataPagamento,
    valor: valorPago,
    descricao: descricaoDas(competencia),
    categoriaId: categoria.id,
    formaPagamento,
    status: 'pago',
    dataPagamento,
    origem: 'das',
    competencia: `${competencia}-01`,
    observacoes: body.observacao ?? null,
  });

  const pagamento = await repo.inserirPagamento(tdb, {
    competencia: `${competencia}-01`,
    valorCalculado: calculado.valor,
    valorPago,
    dataPagamento,
    formaPagamento,
    lancamentoId: lancamento.id,
    observacao: body.observacao ?? null,
  });

  return {
    competencia: {
      ...calculado,
      status: 'pago',
      diasAtraso: 0,
      pagamento: toPagamentoDto(pagamento),
    },
    lancamento: toLancamentoDto(lancamento, categoria),
  };
}

/** Deve rodar em transação: exclui (soft) a despesa gerada e remove o registro do pagamento. */
export async function desfazerPagamento(
  tx: DbExecutor,
  tenantId: string,
  competencia: Competencia,
  hoje: IsoDate,
): Promise<DasCompetenciaDto> {
  const tdb = forTenant(tx, tenantId);
  const pagamento = await repo.buscarPagamento(tdb, competencia);
  if (!pagamento) throw new NotFoundError('Não há pagamento registrado para essa competência');
  if (pagamento.lancamentoId) {
    try {
      await excluirLancamentoInterno(tx, tenantId, pagamento.lancamentoId);
    } catch (err) {
      // A despesa pode já ter sido excluída manualmente; o registro do DAS ainda deve sair.
      if (!(err instanceof NotFoundError)) throw err;
    }
  }
  await repo.removerPagamento(tdb, pagamento.id);
  return obterCompetencia(tx, tenantId, competencia, hoje);
}

// ---------------------------------------------------------------------------
// Receitas por regime (competência × caixa)
// ---------------------------------------------------------------------------

/** Data que conta para o regime (null = receita não entra: pendente no regime de caixa). */
function dataNoRegime(r: repo.ReceitaRow, regime: RegimeApuracao): IsoDate | null {
  if (regime === 'caixa') return r.status === 'pago' ? (r.dataPagamento ?? r.data) : null;
  return r.data;
}

function receitasDoAnoNoRegime(
  receitas: readonly repo.ReceitaRow[],
  regime: RegimeApuracao,
  ano: number,
): (repo.ReceitaRow & { dataRegime: IsoDate })[] {
  const saida: (repo.ReceitaRow & { dataRegime: IsoDate })[] = [];
  for (const r of receitas) {
    const dataRegime = dataNoRegime(r, regime);
    if (dataRegime && Number(dataRegime.slice(0, 4)) === ano) saida.push({ ...r, dataRegime });
  }
  return saida;
}

// ---------------------------------------------------------------------------
// Limite anual
// ---------------------------------------------------------------------------

export async function obterLimite(
  exec: DbExecutor,
  tenantId: string,
  ano: number,
  hoje: IsoDate,
  ctx?: ContextoTenant,
): Promise<LimiteDto> {
  const { tenant, configuracoes } = ctx ?? (await contextoTenant(exec, tenantId));
  const tdb = forTenant(exec, tenantId);
  const regime = configuracoes.regimeApuracao;
  const [sel, receitas] = await Promise.all([
    obterParametros(exec, ano),
    repo.listarReceitasDoAno(tdb, ano),
  ]);
  const acumulado = acumularReceitas(receitas, regime, ano);
  const situacao = situacaoLimite({
    ano,
    params: sel.parametros,
    dataAbertura: tenant.dataAbertura,
    hoje,
    acumulado,
  });

  const porMesValor = new Array<number>(12).fill(0);
  for (const r of receitasDoAnoNoRegime(receitas, regime, ano)) {
    const indice = Number(r.dataRegime.slice(5, 7)) - 1;
    porMesValor[indice] = (porMesValor[indice] ?? 0) + r.valor;
  }
  let acumuladoMes = 0;
  const porMes = competenciasDoAno(ano).map((competencia, i) => {
    const valor = porMesValor[i] ?? 0;
    acumuladoMes += valor;
    return {
      competencia,
      valor,
      acumulado: acumuladoMes,
      percentualAcumulado: percentualDe(acumuladoMes, situacao.limite),
    };
  });

  return {
    ...situacao,
    regime,
    porMes,
    marcas: sel.parametros.alertasLimitePct,
  };
}

// ---------------------------------------------------------------------------
// DASN-SIMEI
// ---------------------------------------------------------------------------

export async function obterDasn(
  exec: DbExecutor,
  tenantId: string,
  anoBase: number,
  hoje: IsoDate,
  ctx?: ContextoTenant,
): Promise<DasnDto> {
  const contexto = ctx ?? (await contextoTenant(exec, tenantId));
  const { tenant, configuracoes } = contexto;
  const tdb = forTenant(exec, tenantId);
  const [sel, receitas, pagamentos, declaracao, limite] = await Promise.all([
    obterParametros(exec, anoBase),
    repo.listarReceitasDoAno(tdb, anoBase),
    repo.listarPagamentosDoAno(tdb, anoBase),
    repo.buscarDeclaracao(tdb, anoBase),
    obterLimite(exec, tenantId, anoBase, hoje, contexto),
  ]);

  const faturamento = apurarFaturamento(
    receitasDoAnoNoRegime(receitas, configuracoes.regimeApuracao, anoBase),
  );
  const devidas = competenciasDevidas({ ano: anoBase, dataAbertura: tenant.dataAbertura, hoje });
  const pagas = new Set(pagamentos.map((p) => p.competencia.slice(0, 7)));
  const dasPendentes = devidas.filter((c) => !pagas.has(c));
  const janela = janelaDasn(anoBase, hoje, sel.parametros);
  const status = declaracao?.status ?? 'pendente';

  return {
    anoBase,
    faturamentoApurado: faturamento.total,
    receitaComercio: faturamento.comercio,
    receitaServicos: faturamento.servicos,
    receitaSemGrupo: faturamento.semGrupo,
    faturamentoDeclarado: declaracao?.faturamentoDeclarado ?? null,
    status,
    dataEntrega: declaracao?.dataEntrega ?? null,
    numeroRecibo: declaracao?.numeroRecibo ?? null,
    prazo: janela.prazo,
    janelaAberta: janela.aberta,
    atrasada: status !== 'entregue' && janela.atrasada,
    diasParaPrazo: janela.diasParaPrazo,
    dasPendentes,
    alertaSemGrupo: faturamento.alertaSemGrupo,
    percentualLimite: limite.percentual,
    excesso: limite.excesso,
  };
}

/** Upsert da declaração com snapshot do faturamento apurado no momento. */
export async function salvarDasn(
  exec: DbExecutor,
  tenantId: string,
  anoBase: number,
  body: SalvarDasnBody,
  hoje: IsoDate,
): Promise<DasnDto> {
  const atual = await obterDasn(exec, tenantId, anoBase, hoje);
  const entregue = body.status === 'entregue';
  await repo.salvarDeclaracao(forTenant(exec, tenantId), anoBase, {
    faturamentoApurado: atual.faturamentoApurado,
    receitaComercio: atual.receitaComercio,
    receitaServicos: atual.receitaServicos,
    faturamentoDeclarado:
      body.faturamentoDeclarado !== undefined
        ? body.faturamentoDeclarado
        : entregue
          ? (atual.faturamentoDeclarado ?? atual.faturamentoApurado)
          : atual.faturamentoDeclarado,
    status: body.status,
    dataEntrega: entregue ? (body.dataEntrega ?? null) : null,
    numeroRecibo: entregue ? (body.numeroRecibo ?? null) : null,
  });
  return obterDasn(exec, tenantId, anoBase, hoje);
}

// ---------------------------------------------------------------------------
// Calendário
// ---------------------------------------------------------------------------

function anosEntre(de: IsoDate, ate: IsoDate): number[] {
  const inicio = Number(de.slice(0, 4));
  const fim = Number(ate.slice(0, 4));
  const anos: number[] = [];
  for (let a = inicio; a <= fim; a++) anos.push(a);
  return anos;
}

export async function obterCalendario(
  exec: DbExecutor,
  tenantId: string,
  de: IsoDate,
  ate: IsoDate,
  hoje: IsoDate,
): Promise<EventoCalendarioDto[]> {
  const ctx = await contextoTenant(exec, tenantId);
  const tdb = forTenant(exec, tenantId);
  const eventos: EventoCalendarioDto[] = [];

  // DAS: o vencimento cai no mês seguinte, então a competência de dezembro do ano anterior
  // pode vencer dentro do período.
  const anosDas = anosEntre(addDias(de, -45), ate);
  const anosComParametros = new Set<number>();
  for (const ano of anosDas) {
    const inicio = mesInicial(ano, ctx.tenant.dataAbertura);
    if (inicio === null) continue;
    let dasAno: DasAnoCalculado;
    try {
      dasAno = await montarDasAno(exec, tenantId, ano, hoje, ctx);
    } catch (err) {
      if (err instanceof UnprocessableError) continue;
      throw err;
    }
    anosComParametros.add(ano);
    for (const c of dasAno.competencias) {
      if (!c.devida || c.vencimento < de || c.vencimento > ate) continue;
      eventos.push({
        data: c.vencimento,
        tipo: 'das',
        titulo: `DAS ${c.competencia.slice(5, 7)}/${c.competencia.slice(0, 4)}`,
        valor: c.status === 'pago' && c.pagamento ? c.pagamento.valorPago : c.valor,
        status: c.status,
        referencia: { id: c.pagamento?.id ?? null, competencia: c.competencia, ano: null },
      });
    }
  }

  // DASN: prazo em maio do ano seguinte ao ano-base.
  const anosBase = anosEntre(de, ate).map((a) => a - 1);
  const declaracoes = await repo.listarDeclaracoes(tdb, anosBase);
  for (const anoBase of anosBase) {
    if (mesInicial(anoBase, ctx.tenant.dataAbertura) === null) continue;
    let prazo: IsoDate;
    try {
      prazo = janelaDasn(anoBase, hoje, (await obterParametros(exec, anoBase)).parametros).prazo;
    } catch (err) {
      if (err instanceof UnprocessableError) continue;
      throw err;
    }
    if (prazo < de || prazo > ate) continue;
    const declaracao = declaracoes.find((d) => d.anoBase === anoBase);
    const entregue = declaracao?.status === 'entregue';
    eventos.push({
      data: prazo,
      tipo: 'dasn',
      titulo: `DASN-SIMEI ${anoBase} (declaração anual)`,
      valor: null,
      status: entregue ? 'pago' : hoje > prazo ? 'atrasado' : 'pendente',
      referencia: { id: declaracao?.id ?? null, competencia: null, ano: anoBase },
    });
  }

  // Parcelas em aberto de contas a pagar/receber.
  for (const p of await repo.listarParcelasAbertas(tdb, de, ate)) {
    const sufixo = p.numeroParcelas > 1 ? ` (${p.numero}/${p.numeroParcelas})` : '';
    eventos.push({
      data: p.vencimento,
      tipo: p.tipo === 'pagar' ? 'parcela_pagar' : 'parcela_receber',
      titulo: `${p.descricao}${sufixo}`,
      valor: p.valor,
      status: p.vencimento < hoje ? 'atrasado' : 'pendente',
      referencia: { id: p.id, competencia: null, ano: null },
    });
  }

  return eventos.sort((a, b) => a.data.localeCompare(b.data) || a.tipo.localeCompare(b.tipo));
}

// ---------------------------------------------------------------------------
// Alertas
// ---------------------------------------------------------------------------

export async function listarAlertas(
  exec: DbExecutor,
  tenantId: string,
  hoje: IsoDate,
): Promise<Alerta[]> {
  const ctx = await contextoTenant(exec, tenantId);
  const { tenant, configuracoes } = ctx;
  const tdb = forTenant(exec, tenantId);
  const anoAtual = anoDeHoje(hoje);

  // DAS do ano atual e do anterior (atrasados antigos continuam alertando).
  const das: DasParaAlerta[] = [];
  const parametrosDesatualizados: number[] = [];
  for (const ano of [anoAtual - 1, anoAtual]) {
    if (mesInicial(ano, tenant.dataAbertura) === null) continue;
    let dasAno: DasAnoCalculado;
    try {
      dasAno = await montarDasAno(exec, tenantId, ano, hoje, ctx);
    } catch (err) {
      if (err instanceof UnprocessableError) continue;
      throw err;
    }
    if (dasAno.parametrosDesatualizados && ano === anoAtual) parametrosDesatualizados.push(ano);
    for (const c of dasAno.competencias) {
      if (!c.devida || c.status === 'futuro') continue;
      das.push({
        competencia: c.competencia,
        vencimento: c.vencimento,
        status: c.status,
        valor: c.valor,
      });
    }
  }

  let limite: LimiteDto | null = null;
  try {
    limite = await obterLimite(exec, tenantId, anoAtual, hoje, ctx);
  } catch (err) {
    if (!(err instanceof UnprocessableError)) throw err;
  }

  // DASN dos dois últimos anos-base, só a partir da abertura (ou do cadastro, sem data de abertura).
  const anoCadastro = Number(String(isoTimestamp(tenant.createdAt) ?? '').slice(0, 4)) || anoAtual;
  const anosBase = [anoAtual - 2, anoAtual - 1].filter((ano) => {
    if (mesInicial(ano, tenant.dataAbertura) === null) return false;
    return tenant.dataAbertura ? true : ano >= anoCadastro;
  });
  const declaracoes = await repo.listarDeclaracoes(tdb, anosBase);
  const dasn: DasnParaAlerta[] = [];
  for (const anoBase of anosBase) {
    let params: ParametrosMei;
    try {
      params = (await obterParametros(exec, anoBase)).parametros;
    } catch (err) {
      if (err instanceof UnprocessableError) continue;
      throw err;
    }
    const janela = janelaDasn(anoBase, hoje, params);
    const declaracao = declaracoes.find((d) => d.anoBase === anoBase);
    dasn.push({
      anoBase,
      prazo: janela.prazo,
      status: declaracao?.status ?? 'pendente',
      janelaAberta: janela.aberta,
    });
  }

  const parcelas: Partial<Record<'pagar' | 'receber', ParcelasParaAlerta>> = {};
  const resumo = await repo.resumirParcelasParaAlertas(
    tdb,
    hoje,
    addDias(hoje, configuracoes.diasAlertaVencimento),
  );
  for (const r of resumo) {
    parcelas[r.tipo] = {
      atrasadas: { quantidade: r.atrasadasQuantidade, valor: r.atrasadasValor },
      proximas: { quantidade: r.proximasQuantidade, valor: r.proximasValor },
    };
  }

  const [receitaSemGrupoDasn, dispensados] = await Promise.all([
    repo.existeReceitaSemGrupo(tdb, [anoAtual - 1, anoAtual]),
    repo.listarDispensados(tdb, hoje),
  ]);

  const contexto: ContextoAlertas = {
    hoje,
    diasAlertaDas: configuracoes.diasAlertaDas,
    diasAlertaVencimento: configuracoes.diasAlertaVencimento,
    das,
    limite,
    dasn,
    parcelas,
    parametrosDesatualizados,
    dataAberturaAusente: !tenant.dataAbertura,
    receitaSemGrupoDasn,
    dispensados,
  };
  return gerarAlertas(contexto);
}

const DIAS_DISPENSA_PADRAO = 30;

export async function dispensarAlerta(
  exec: DbExecutor,
  tenantId: string,
  chave: string,
  ate: IsoDate | undefined,
  hoje: IsoDate,
): Promise<{ chave: string; dispensadoAte: IsoDate }> {
  const dispensadoAte = ate ?? addDias(hoje, DIAS_DISPENSA_PADRAO);
  if (dispensadoAte < hoje) {
    throw new UnprocessableError('A data limite da dispensa não pode ser no passado', [
      { campo: 'ate', mensagem: 'Data no passado' },
    ]);
  }
  await repo.dispensar(forTenant(exec, tenantId), chave, dispensadoAte);
  return { chave, dispensadoAte };
}

export async function reativarAlerta(
  exec: DbExecutor,
  tenantId: string,
  chave: string,
): Promise<void> {
  const removido = await repo.reativar(forTenant(exec, tenantId), chave);
  if (!removido) throw new NotFoundError('Esse alerta não estava dispensado');
}

export function anoPadrao(hoje: IsoDate): number {
  return anoDeHoje(hoje);
}

/** Declaração da DASN cujo prazo está correndo: ano anterior ao atual. */
export function anoBasePadrao(hoje: IsoDate): number {
  return anoDeHoje(hoje) - 1;
}
