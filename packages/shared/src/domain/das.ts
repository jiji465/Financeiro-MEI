// DAS mensal do MEI: cálculo (INSS + ICMS + ISS), vencimento em dia útil, competências devidas e status.
// Nunca hardcodar valores legais aqui: tudo vem de ParametrosMei (tabela parametros_mei, por ano).
import type { Atividade, CaminhoneiroTributos, StatusDas } from '../constants.js';
import {
  addMesesCompetencia,
  type Competencia,
  competenciaDe,
  competenciasEntre,
  diasEntre,
  type IsoDate,
  montarCompetencia,
  montarIsoDate,
  parseCompetencia,
  parseIsoDate,
} from '../dates.js';
import { type Centavos, percentualBp } from '../money.js';
import { proximoDiaUtil } from './calendario.js';

/** Espelha a tabela parametros_mei (uma linha por ano). Valores em centavos e basis points. */
export interface ParametrosMei {
  ano: number;
  salarioMinimo: Centavos;
  /** INSS do MEI comum (500 = 5%). */
  aliquotaInssBp: number;
  /** INSS do MEI caminhoneiro (1200 = 12%). */
  aliquotaInssCaminhoneiroBp: number;
  /** ICMS fixo mensal (comércio/indústria/transporte intermunicipal). */
  icms: Centavos;
  /** ISS fixo mensal (serviços). */
  iss: Centavos;
  limiteAnual: Centavos;
  limiteMensalProporcional: Centavos;
  /** Tolerância de excesso (2000 = 20%). */
  toleranciaExcessoBp: number;
  diaVencimentoDas: number;
  dasnPrazoDia: number;
  dasnPrazoMes: number;
  /** Percentuais que disparam alertas de limite (ex.: [70, 85, 100]). */
  alertasLimitePct: number[];
}

export interface DetalhamentoDas {
  inss: Centavos;
  icms: Centavos;
  iss: Centavos;
  total: Centavos;
  aliquotaInssBp: number;
  salarioMinimo: Centavos;
}

/** Quais tributos (além do INSS) o MEI recolhe, conforme atividade e, para caminhoneiro, os tributos declarados. */
export function tributosDevidos(
  atividade: Atividade,
  tributosCaminhoneiro: CaminhoneiroTributos | null | undefined,
): { icms: boolean; iss: boolean } {
  switch (atividade) {
    case 'comercio':
      return { icms: true, iss: false };
    case 'servicos':
      return { icms: false, iss: true };
    case 'comercio_servicos':
      return { icms: true, iss: true };
    case 'caminhoneiro': {
      const t = tributosCaminhoneiro ?? 'icms';
      return { icms: t === 'icms' || t === 'ambos', iss: t === 'iss' || t === 'ambos' };
    }
  }
}

/**
 * Calcula o DAS mensal: inss = round(salarioMinimo × aliquota / 10000) + ICMS e/ou ISS conforme a atividade.
 * Use os parâmetros do ANO DA COMPETÊNCIA.
 */
export function calcularDas(
  params: ParametrosMei,
  atividade: Atividade,
  tributosCaminhoneiro: CaminhoneiroTributos | null = null,
): DetalhamentoDas {
  const aliquotaInssBp =
    atividade === 'caminhoneiro' ? params.aliquotaInssCaminhoneiroBp : params.aliquotaInssBp;
  const inss = percentualBp(params.salarioMinimo, aliquotaInssBp);
  const devidos = tributosDevidos(atividade, tributosCaminhoneiro);
  const icms = devidos.icms ? params.icms : 0;
  const iss = devidos.iss ? params.iss : 0;
  return {
    inss,
    icms,
    iss,
    total: inss + icms + iss,
    aliquotaInssBp,
    salarioMinimo: params.salarioMinimo,
  };
}

export interface LinhaDetalhamento {
  codigo: 'inss' | 'icms' | 'iss';
  rotulo: string;
  valor: Centavos;
}

/** Linhas exibíveis do detalhamento (só tributos devidos), para a UI e o PDF. */
export function detalhamentoDas(det: DetalhamentoDas): LinhaDetalhamento[] {
  const linhas: LinhaDetalhamento[] = [
    {
      codigo: 'inss',
      rotulo: `INSS (${(det.aliquotaInssBp / 100).toLocaleString('pt-BR')}% do salário mínimo)`,
      valor: det.inss,
    },
  ];
  if (det.icms > 0) linhas.push({ codigo: 'icms', rotulo: 'ICMS', valor: det.icms });
  if (det.iss > 0) linhas.push({ codigo: 'iss', rotulo: 'ISS', valor: det.iss });
  return linhas;
}

/**
 * Vencimento do DAS da competência: dia `diaVencimento` (padrão 20) do mês seguinte,
 * empurrado para o próximo dia útil (fins de semana e feriados nacionais).
 */
export function vencimentoDas(competencia: Competencia, diaVencimento = 20): IsoDate {
  const seguinte = parseCompetencia(addMesesCompetencia(competencia, 1));
  const nominal = montarIsoDate({ ano: seguinte.ano, mes: seguinte.mes, dia: diaVencimento });
  return proximoDiaUtil(nominal);
}

export interface CompetenciasDevidasInput {
  ano: number;
  /** Data de abertura do MEI; null/undefined = considera desde janeiro. */
  dataAbertura: IsoDate | null | undefined;
  hoje: IsoDate;
}

/**
 * Competências devidas no ano: de max(mês de abertura, jan) até min(dez, mês atual).
 * Anos futuros devolvem lista vazia; anos passados devolvem o ano inteiro (a partir da abertura).
 */
export function competenciasDevidas({
  ano,
  dataAbertura,
  hoje,
}: CompetenciasDevidasInput): Competencia[] {
  const inicio = mesInicial(ano, dataAbertura);
  if (inicio === null) return [];
  const atual = parseIsoDate(hoje);
  let mesFim: number;
  if (atual.ano > ano) mesFim = 12;
  else if (atual.ano < ano) return [];
  else mesFim = atual.mes;
  if (mesFim < inicio) return [];
  return competenciasEntre(
    montarCompetencia({ ano, mes: inicio }),
    montarCompetencia({ ano, mes: mesFim }),
  );
}

/** Mês (1-12) em que o MEI passa a dever DAS no ano; null se abriu depois do ano. */
export function mesInicial(ano: number, dataAbertura: IsoDate | null | undefined): number | null {
  if (!dataAbertura) return 1;
  const abertura = parseIsoDate(dataAbertura);
  if (abertura.ano > ano) return null;
  if (abertura.ano < ano) return 1;
  return abertura.mes;
}

/** Todas as competências do ano (jan-dez), devidas ou não. */
export function competenciasDoAno(ano: number): Competencia[] {
  return competenciasEntre(montarCompetencia({ ano, mes: 1 }), montarCompetencia({ ano, mes: 12 }));
}

export interface StatusDasInput {
  competencia: Competencia;
  /** Vencimento já calculado (senão usa vencimentoDas). */
  vencimento?: IsoDate;
  pago: boolean;
  hoje: IsoDate;
}

/**
 * pago → 'pago'; competência posterior ao mês atual → 'futuro';
 * hoje > vencimento → 'atrasado'; senão 'pendente'.
 */
export function statusDas({ competencia, vencimento, pago, hoje }: StatusDasInput): StatusDas {
  if (pago) return 'pago';
  if (competencia > competenciaDe(hoje)) return 'futuro';
  const venc = vencimento ?? vencimentoDas(competencia);
  return hoje > venc ? 'atrasado' : 'pendente';
}

/** Dias de atraso (0 se não vencido). */
export function diasAtrasoDas(vencimento: IsoDate, hoje: IsoDate): number {
  return Math.max(0, diasEntre(vencimento, hoje));
}

export interface ParametrosSelecionados {
  parametros: ParametrosMei;
  /** true quando não existe linha para o ano pedido (usou o maior ano ≤ pedido). */
  desatualizado: boolean;
}

/**
 * Lookup de parâmetros: ano exato; senão o maior `ano <= pedido` marcado como desatualizado;
 * null quando não há nenhum ano ≤ pedido.
 */
export function selecionarParametros(
  lista: readonly ParametrosMei[],
  ano: number,
): ParametrosSelecionados | null {
  const exato = lista.find((p) => p.ano === ano);
  if (exato) return { parametros: exato, desatualizado: false };
  const anteriores = lista.filter((p) => p.ano < ano).sort((a, b) => b.ano - a.ano);
  const maisRecente = anteriores[0];
  if (!maisRecente) return null;
  return { parametros: maisRecente, desatualizado: true };
}
