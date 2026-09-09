// Fluxo de caixa: saldo inicial = pagos antes de `de`; realizado por status pago; previsto = parcelas
// abertas + lançamentos pendentes; itens vencidos (previstos com data < hoje) entram no período atual.
import type { AgrupamentoFluxo, TipoLancamento } from '../constants.js';
import {
  addDias,
  addMonthsClamp,
  competenciaDe,
  diaDaSemana,
  inicioMes,
  type IsoDate,
  isoParaUtc,
  minIsoDate,
  ultimoDiaDoMes,
} from '../dates.js';
import type { Centavos } from '../money.js';

export interface ItemFluxo {
  data: IsoDate;
  tipo: TipoLancamento;
  valor: Centavos;
  /** true = pago (realizado); false = previsto (parcela aberta ou lançamento pendente). */
  realizado: boolean;
}

export interface PeriodoFluxo {
  /** AAAA-MM-DD (dia), AAAA-Www (semana ISO) ou AAAA-MM (mês). */
  periodo: string;
  inicio: IsoDate;
  fim: IsoDate;
  receitas: Centavos;
  despesas: Centavos;
  receitasPrevistas: Centavos;
  despesasPrevistas: Centavos;
  saldoPeriodo: Centavos;
  saldoAcumulado: Centavos;
  saldoProjetado: Centavos;
}

export interface OpcoesFluxo {
  de: IsoDate;
  ate: IsoDate;
  agrupamento: AgrupamentoFluxo;
  saldoInicial: Centavos;
  hoje: IsoDate;
  /** false ignora itens previstos (padrão true). */
  incluirPrevisao?: boolean;
}

/** Segunda-feira da semana ISO da data. */
export function inicioSemana(iso: IsoDate): IsoDate {
  const dow = diaDaSemana(iso); // 0 = domingo
  const recuo = dow === 0 ? 6 : dow - 1;
  return addDias(iso, -recuo);
}

/** Rótulo de semana ISO 8601: AAAA-Www (ano da quinta-feira da semana). */
export function rotuloSemanaIso(iso: IsoDate): string {
  const d = isoParaUtc(iso);
  const dia = d.getUTCDay() || 7; // 1..7, domingo = 7
  d.setUTCDate(d.getUTCDate() + 4 - dia); // quinta-feira da semana
  const anoIso = d.getUTCFullYear();
  const inicioAnoIso = Date.UTC(anoIso, 0, 1);
  const semana = Math.ceil(((d.getTime() - inicioAnoIso) / 86_400_000 + 1) / 7);
  return `${anoIso}-W${String(semana).padStart(2, '0')}`;
}

/** Rótulo do período que contém a data. */
export function rotuloPeriodo(iso: IsoDate, agrupamento: AgrupamentoFluxo): string {
  switch (agrupamento) {
    case 'dia':
      return iso;
    case 'semana':
      return rotuloSemanaIso(iso);
    case 'mes':
      return competenciaDe(iso);
  }
}

export interface FaixaPeriodo {
  periodo: string;
  inicio: IsoDate;
  fim: IsoDate;
}

/** Faixas contíguas cobrindo [de, ate]; a primeira/última são recortadas nos limites. */
export function gerarPeriodos(
  de: IsoDate,
  ate: IsoDate,
  agrupamento: AgrupamentoFluxo,
): FaixaPeriodo[] {
  const faixas: FaixaPeriodo[] = [];
  if (de > ate) return faixas;
  let inicio = de;
  while (inicio <= ate) {
    let fimNatural: IsoDate;
    let proximo: IsoDate;
    if (agrupamento === 'dia') {
      fimNatural = inicio;
      proximo = addDias(inicio, 1);
    } else if (agrupamento === 'semana') {
      fimNatural = addDias(inicioSemana(inicio), 6);
      proximo = addDias(fimNatural, 1);
    } else {
      fimNatural = ultimoDiaDoMes(inicio);
      proximo = addMonthsClamp(inicioMes(inicio), 1);
    }
    const fim = minIsoDate(fimNatural, ate);
    faixas.push({ periodo: rotuloPeriodo(inicio, agrupamento), inicio, fim });
    inicio = proximo;
  }
  return faixas;
}

/**
 * Agrupa itens por período. Realizados fora de [de, ate] são ignorados (o saldo inicial já os cobre);
 * previstos vencidos (data < hoje) são deslocados para hoje (período atual); previstos fora da
 * faixa são ignorados.
 */
export function agruparPorPeriodo(
  itens: readonly ItemFluxo[],
  opcoes: OpcoesFluxo,
): PeriodoFluxo[] {
  const { de, ate, agrupamento, saldoInicial, hoje } = opcoes;
  const incluirPrevisao = opcoes.incluirPrevisao ?? true;
  const faixas = gerarPeriodos(de, ate, agrupamento);
  const acumuladores = faixas.map((f) => ({
    ...f,
    receitas: 0,
    despesas: 0,
    receitasPrevistas: 0,
    despesasPrevistas: 0,
  }));

  const indicePor = (data: IsoDate) =>
    acumuladores.findIndex((f) => data >= f.inicio && data <= f.fim);

  for (const item of itens) {
    if (!item.realizado && !incluirPrevisao) continue;
    const dataEfetiva = !item.realizado && item.data < hoje ? hoje : item.data;
    const idx = indicePor(dataEfetiva);
    if (idx < 0) continue;
    const acc = acumuladores[idx];
    if (!acc) continue;
    if (item.realizado) {
      if (item.tipo === 'receita') acc.receitas += item.valor;
      else acc.despesas += item.valor;
    } else if (item.tipo === 'receita') acc.receitasPrevistas += item.valor;
    else acc.despesasPrevistas += item.valor;
  }

  let saldoAcumulado = saldoInicial;
  let previstoAcumulado = 0;
  return acumuladores.map((acc) => {
    const saldoPeriodo = acc.receitas - acc.despesas;
    saldoAcumulado += saldoPeriodo;
    previstoAcumulado += acc.receitasPrevistas - acc.despesasPrevistas;
    return {
      periodo: acc.periodo,
      inicio: acc.inicio,
      fim: acc.fim,
      receitas: acc.receitas,
      despesas: acc.despesas,
      receitasPrevistas: acc.receitasPrevistas,
      despesasPrevistas: acc.despesasPrevistas,
      saldoPeriodo,
      saldoAcumulado,
      saldoProjetado: saldoAcumulado + previstoAcumulado,
    };
  });
}

/** Saldo considerando só os realizados. */
export function saldoRealizado(saldoInicial: Centavos, itens: readonly ItemFluxo[]): Centavos {
  return itens
    .filter((i) => i.realizado)
    .reduce((acc, i) => acc + (i.tipo === 'receita' ? i.valor : -i.valor), saldoInicial);
}

/** Saldo projetado: realizados + previstos. */
export function saldoProjetado(saldoInicial: Centavos, itens: readonly ItemFluxo[]): Centavos {
  return itens.reduce((acc, i) => acc + (i.tipo === 'receita' ? i.valor : -i.valor), saldoInicial);
}
