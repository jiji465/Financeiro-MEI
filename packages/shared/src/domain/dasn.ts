// DASN-SIMEI (declaração anual do MEI): prazo, janela de entrega, apuração do faturamento
// separado por grupo (comércio / serviços) e checagem de DAS pendentes no ano-base.
import type { GrupoDasn } from '../constants.js';
import { type Competencia, diasEntre, inicioAno, type IsoDate, montarIsoDate } from '../dates.js';
import type { Centavos } from '../money.js';
import type { ParametrosMei } from './das.js';

export type ParametrosDasn = Pick<ParametrosMei, 'dasnPrazoDia' | 'dasnPrazoMes'>;

const PRAZO_PADRAO: ParametrosDasn = { dasnPrazoDia: 31, dasnPrazoMes: 5 };

/** Prazo de entrega: 31/05 do ano seguinte ao ano-base (parametrizável). */
export function prazoDasn(anoBase: number, params: ParametrosDasn = PRAZO_PADRAO): IsoDate {
  return montarIsoDate({ ano: anoBase + 1, mes: params.dasnPrazoMes, dia: params.dasnPrazoDia });
}

export type SituacaoJanelaDasn = 'futura' | 'aberta' | 'atrasada';

export interface JanelaDasn {
  anoBase: number;
  /** 01/01 do ano seguinte: a partir daí a declaração pode ser entregue. */
  abertura: IsoDate;
  prazo: IsoDate;
  aberta: boolean;
  atrasada: boolean;
  /** Dias até o prazo (negativo quando já passou). */
  diasParaPrazo: number;
  situacao: SituacaoJanelaDasn;
}

/** Janela de entrega da DASN do ano-base em relação a `hoje`. */
export function janelaDasn(
  anoBase: number,
  hoje: IsoDate,
  params: ParametrosDasn = PRAZO_PADRAO,
): JanelaDasn {
  const abertura = inicioAno(anoBase + 1);
  const prazo = prazoDasn(anoBase, params);
  const diasParaPrazo = diasEntre(hoje, prazo);
  const atrasada = hoje > prazo;
  const aberta = hoje >= abertura;
  const situacao: SituacaoJanelaDasn = !aberta ? 'futura' : atrasada ? 'atrasada' : 'aberta';
  return { anoBase, abertura, prazo, aberta, atrasada, diasParaPrazo, situacao };
}

export interface ReceitaDasn {
  valor: Centavos;
  /** grupo_dasn da categoria da receita; null = categoria sem classificação. */
  grupoDasn: GrupoDasn | null;
}

export interface FaturamentoApurado {
  total: Centavos;
  comercio: Centavos;
  servicos: Centavos;
  /** Receitas em categorias sem grupo — precisam ser classificadas antes de declarar. */
  semGrupo: Centavos;
  alertaSemGrupo: boolean;
}

/** Separa o faturamento por grupo da DASN. Receitas sem grupo entram no total e disparam alerta. */
export function apurarFaturamento(receitas: readonly ReceitaDasn[]): FaturamentoApurado {
  let comercio = 0;
  let servicos = 0;
  let semGrupo = 0;
  for (const r of receitas) {
    if (r.grupoDasn === 'comercio') comercio += r.valor;
    else if (r.grupoDasn === 'servicos') servicos += r.valor;
    else semGrupo += r.valor;
  }
  return {
    total: comercio + servicos + semGrupo,
    comercio,
    servicos,
    semGrupo,
    alertaSemGrupo: semGrupo > 0,
  };
}

/** Competências devidas sem DAS pago (ordem crescente). */
export function dasPendentesDasn(
  devidas: readonly Competencia[],
  pagas: readonly Competencia[],
): Competencia[] {
  const set = new Set(pagas);
  return devidas.filter((c) => !set.has(c)).sort();
}

export interface ChecagemDasn {
  faturamento: FaturamentoApurado;
  dasPendentes: Competencia[];
  janela: JanelaDasn;
  /** Tudo pronto para declarar: janela aberta, sem DAS pendente e sem receita sem grupo. */
  prontaParaDeclarar: boolean;
}

export function checarDasn(input: {
  anoBase: number;
  hoje: IsoDate;
  receitas: readonly ReceitaDasn[];
  competenciasDevidas: readonly Competencia[];
  competenciasPagas: readonly Competencia[];
  params?: ParametrosDasn;
}): ChecagemDasn {
  const faturamento = apurarFaturamento(input.receitas);
  const dasPendentes = dasPendentesDasn(input.competenciasDevidas, input.competenciasPagas);
  const janela = janelaDasn(input.anoBase, input.hoje, input.params);
  return {
    faturamento,
    dasPendentes,
    janela,
    prontaParaDeclarar: janela.aberta && dasPendentes.length === 0 && !faturamento.alertaSemGrupo,
  };
}
