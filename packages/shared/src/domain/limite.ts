// Limite anual de faturamento do MEI: limite aplicável (cheio ou proporcional no ano de abertura),
// situação (acumulado, percentual, projeção, nível) e classificação do excesso (até 20% / acima de 20%).
import {
  LABEL_TIPO_EXCESSO,
  type NivelLimite,
  type RegimeApuracao,
  type StatusLancamento,
  type TipoExcesso,
} from '../constants.js';
import {
  diasEntre,
  fimAno,
  inicioAno,
  type IsoDate,
  maxIsoDate,
  mesesEntre,
  minIsoDate,
  montarIsoDate,
  parseIsoDate,
} from '../dates.js';
import { arredondarHalfUp, type Centavos, percentualBp, percentualDe } from '../money.js';
import { mesInicial, type ParametrosMei } from './das.js';

export type ParametrosLimite = Pick<
  ParametrosMei,
  'limiteAnual' | 'limiteMensalProporcional' | 'toleranciaExcessoBp' | 'alertasLimitePct'
>;

/** Ano cheio = limite_anual; ano de abertura = limite_mensal_proporcional × (12 − mês de abertura + 1). */
export function limiteAplicavel(
  params: ParametrosLimite,
  ano: number,
  dataAbertura: IsoDate | null | undefined,
): Centavos {
  if (!dataAbertura) return params.limiteAnual;
  const abertura = parseIsoDate(dataAbertura);
  if (abertura.ano !== ano) return params.limiteAnual;
  return params.limiteMensalProporcional * (12 - abertura.mes + 1);
}

/** Tolerância = limite × (1 + toleranciaExcessoBp/10000), ex.: 8.100.000 × 1,20 = 9.720.000. */
export function toleranciaLimite(params: ParametrosLimite, limite: Centavos): Centavos {
  return limite + percentualBp(limite, params.toleranciaExcessoBp);
}

export interface ReceitaParaLimite {
  data: IsoDate;
  dataPagamento: IsoDate | null;
  status: StatusLancamento;
  valor: Centavos;
}

/**
 * Soma as receitas do ano conforme o regime: competência usa `data` (pagas e pendentes);
 * caixa usa coalesce(dataPagamento, data) e só status pago.
 */
export function acumularReceitas(
  receitas: readonly ReceitaParaLimite[],
  regime: RegimeApuracao,
  ano: number,
): Centavos {
  const de = inicioAno(ano);
  const ate = fimAno(ano);
  let total = 0;
  for (const r of receitas) {
    if (regime === 'caixa') {
      if (r.status !== 'pago') continue;
      const data = r.dataPagamento ?? r.data;
      if (data >= de && data <= ate) total += r.valor;
    } else if (r.data >= de && r.data <= ate) {
      total += r.valor;
    }
  }
  return total;
}

/** ok | atencao (≥ marca[0]) | alerta (≥ marca[1]) | estourado (≥ marca[2]); padrão [70, 85, 100]. */
export function nivelLimite(
  percentual: number,
  marcas: readonly number[] = [70, 85, 100],
): NivelLimite {
  const [atencao = 70, alerta = 85, estourado = 100] = marcas;
  if (percentual >= estourado) return 'estourado';
  if (percentual >= alerta) return 'alerta';
  if (percentual >= atencao) return 'atencao';
  return 'ok';
}

/** null sem excesso; 'ate_20' quando acumulado ≤ tolerância; 'acima_20' além dela. */
export function classificarExcesso(
  acumulado: Centavos,
  limite: Centavos,
  tolerancia: Centavos,
): TipoExcesso | null {
  if (acumulado <= limite) return null;
  return acumulado <= tolerancia ? 'ate_20' : 'acima_20';
}

export interface SituacaoLimite {
  ano: number;
  anoAbertura: boolean;
  /** Primeiro mês considerado (1 ou mês de abertura). */
  mesInicio: number;
  mesesConsiderados: number;
  limite: Centavos;
  tolerancia: Centavos;
  acumulado: Centavos;
  /** max(0, limite − acumulado) */
  restante: Centavos;
  /** acumulado / limite, 0-100+ com duas casas */
  percentual: number;
  nivel: NivelLimite;
  excesso: TipoExcesso | null;
  /** max(0, acumulado − limite) */
  valorExcedido: Centavos;
  /** Dias desde o início considerado até hoje (inclusive), limitado ao ano. */
  diasDecorridos: number;
  diasTotais: number;
  /** acumulado / meses decorridos */
  mediaMensal: Centavos;
  /** Projeção linear para o fim do ano; null com menos de 15 dias decorridos. */
  projecao: Centavos | null;
  projecaoPercentual: number | null;
  projecaoExcede: boolean;
  /** Explicação em pt-BR da consequência do excesso; null sem excesso. */
  consequencia: string | null;
}

export interface SituacaoLimiteInput {
  ano: number;
  params: ParametrosLimite;
  dataAbertura: IsoDate | null | undefined;
  hoje: IsoDate;
  /** Receitas do ano já somadas conforme o regime (ver acumularReceitas). */
  acumulado: Centavos;
  /** Mínimo de dias decorridos para projetar (padrão 15). */
  diasMinimosProjecao?: number;
}

export function situacaoLimite({
  ano,
  params,
  dataAbertura,
  hoje,
  acumulado,
  diasMinimosProjecao = 15,
}: SituacaoLimiteInput): SituacaoLimite {
  const abertura = dataAbertura ? parseIsoDate(dataAbertura) : null;
  const anoAbertura = abertura?.ano === ano;
  const mesInicio = mesInicial(ano, dataAbertura) ?? 1;
  const mesesConsiderados = 12 - mesInicio + 1;

  const limite = limiteAplicavel(params, ano, dataAbertura);
  const tolerancia = toleranciaLimite(params, limite);
  const percentual = percentualDe(acumulado, limite);
  const nivel = nivelLimite(percentual, params.alertasLimitePct);
  const excesso = classificarExcesso(acumulado, limite, tolerancia);

  // Janela de dias: do início considerado até min(hoje, 31/12), inclusive.
  const inicio =
    anoAbertura && dataAbertura ? maxIsoDate(inicioAno(ano), dataAbertura) : inicioAno(ano);
  const fim = fimAno(ano);
  const ate = minIsoDate(hoje, fim);
  const diasTotais = diasEntre(inicio, fim) + 1;
  const diasDecorridos = ate < inicio ? 0 : diasEntre(inicio, ate) + 1;
  const mesesDecorridos = ate < inicio ? 0 : mesesEntre(inicio, ate) + 1;

  const mediaMensal = mesesDecorridos === 0 ? 0 : arredondarHalfUp(acumulado / mesesDecorridos);
  const projecao =
    diasDecorridos < diasMinimosProjecao
      ? null
      : arredondarHalfUp((acumulado / diasDecorridos) * diasTotais);
  const projecaoPercentual = projecao === null ? null : percentualDe(projecao, limite);

  return {
    ano,
    anoAbertura,
    mesInicio,
    mesesConsiderados,
    limite,
    tolerancia,
    acumulado,
    restante: Math.max(0, limite - acumulado),
    percentual,
    nivel,
    excesso,
    valorExcedido: Math.max(0, acumulado - limite),
    diasDecorridos,
    diasTotais,
    mediaMensal,
    projecao,
    projecaoPercentual,
    projecaoExcede: projecao !== null && projecao > limite,
    consequencia: excesso ? LABEL_TIPO_EXCESSO[excesso] : null,
  };
}

/** Marcas de referência (70/85/100) em centavos para desenhar a barra de progresso. */
export function marcasLimite(
  limite: Centavos,
  marcas: readonly number[] = [70, 85, 100],
): Centavos[] {
  return marcas.map((pct) => arredondarHalfUp((limite * pct) / 100));
}

/** Competência (AAAA-MM-01) do primeiro mês considerado no ano, útil para consultas. */
export function inicioConsiderado(ano: number, dataAbertura: IsoDate | null | undefined): IsoDate {
  const mes = mesInicial(ano, dataAbertura) ?? 1;
  return montarIsoDate({ ano, mes, dia: 1 });
}
