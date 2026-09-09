// Datas de negócio são strings "AAAA-MM-DD". Toda formatação é feita por manipulação de texto
// ou em UTC — nunca `new Date('AAAA-MM-DD')`, que muda o dia no fuso do Brasil.
import { TZDate } from '@date-fns/tz';
import {
  addMonthsClamp,
  hojeSP,
  isIsoDate,
  montarIsoDate,
  parseIsoDate,
  toIsoDate,
  TZ_SAO_PAULO,
  ultimoDiaDoMes,
  type IsoDate,
} from '@meifin/shared';
import { format } from 'date-fns';

export {
  addMonthsClamp,
  compararIsoDate,
  diasNoMes,
  hojeSP,
  isIsoDate,
  montarIsoDate,
  parseIsoDate,
  primeiroDiaDoMes,
  toIsoDate,
  ultimoDiaDoMes,
} from '@meifin/shared';
export type { IsoDate } from '@meifin/shared';

export const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

export const MESES_CURTOS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const;

export const DIAS_SEMANA = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
] as const;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Aceita "AAAA-MM-DD" ou um timestamp ISO; timestamps são convertidos para a data em São Paulo. */
function paraIso(valor: string | Date | null | undefined): IsoDate | null {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : toIsoDate(valor);
  const texto: string = valor;
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return isIsoDate(texto) ? texto : null;
  if (texto.length > 10) {
    const instante = new Date(texto);
    return Number.isNaN(instante.getTime()) ? null : toIsoDate(instante);
  }
  return null;
}

/** "2026-03-05" → "05/03/2026". Valores inválidos/vazios → "". */
export function formatData(valor: string | Date | null | undefined): string {
  const iso = paraIso(valor);
  if (!iso) return '';
  const { ano, mes, dia } = parseIsoDate(iso);
  return `${pad(dia)}/${pad(mes)}/${ano}`;
}

/** "2026-03-05" → "05/03". */
export function formatDataCurta(valor: string | Date | null | undefined): string {
  const iso = paraIso(valor);
  if (!iso) return '';
  const { mes, dia } = parseIsoDate(iso);
  return `${pad(dia)}/${pad(mes)}`;
}

/** "2026-03-05" → "5 de março de 2026". */
export function formatDataExtenso(valor: string | Date | null | undefined): string {
  const iso = paraIso(valor);
  if (!iso) return '';
  const { ano, mes, dia } = parseIsoDate(iso);
  return `${dia} de ${MESES[mes - 1]} de ${ano}`;
}

/** Timestamp ISO → "05/03/2026 14:30" (fuso de São Paulo). */
export function formatDataHora(valor: string | Date | null | undefined): string {
  if (!valor) return '';
  const instante = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(instante.getTime())) return '';
  return format(new TZDate(instante, TZ_SAO_PAULO), 'dd/MM/yyyy HH:mm');
}

/** Competência "2026-03" (ou data "2026-03-05") → "mar/2026". */
export function formatMesAno(competencia: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})/.exec(competencia ?? '');
  if (!m) return '';
  const mes = Number(m[2]);
  const nome = MESES_CURTOS[mes - 1];
  return nome ? `${nome}/${m[1]}` : '';
}

/** Competência "2026-03" (ou data) → "março de 2026". */
export function formatMesExtenso(competencia: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})/.exec(competencia ?? '');
  if (!m) return '';
  const mes = Number(m[2]);
  const nome = MESES[mes - 1];
  return nome ? `${nome} de ${m[1]}` : '';
}

/** Nome do mês (1-12), com opção de capitalizar. */
export function nomeMes(
  mes: number,
  opcoes: { curto?: boolean; capitalizar?: boolean } = {},
): string {
  const nome = (opcoes.curto ? MESES_CURTOS : MESES)[mes - 1] ?? '';
  return opcoes.capitalizar ? nome.charAt(0).toUpperCase() + nome.slice(1) : nome;
}

/** Dia da semana de uma data ISO ("segunda-feira"). */
export function diaDaSemana(iso: IsoDate): string {
  const { ano, mes, dia } = parseIsoDate(iso);
  return DIAS_SEMANA[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()] ?? '';
}

function diasDesdeEpoca(iso: IsoDate): number {
  const { ano, mes, dia } = parseIsoDate(iso);
  return Math.round(Date.UTC(ano, mes - 1, dia) / 86_400_000);
}

/** Dias de `hoje` até `iso` (negativo se já passou). */
export function diasAte(iso: IsoDate, hoje: IsoDate = hojeSP()): number {
  return diasDesdeEpoca(iso) - diasDesdeEpoca(hoje);
}

/** "hoje", "amanhã", "em 3 dias", "há 2 dias", "ontem". */
export function descreverPrazo(iso: IsoDate, hoje: IsoDate = hojeSP()): string {
  const dias = diasAte(iso, hoje);
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  if (dias === -1) return 'ontem';
  if (dias > 0) return `em ${dias} dias`;
  return `há ${Math.abs(dias)} dias`;
}

/** Soma dias a uma data ISO. */
export function addDias(iso: IsoDate, dias: number): IsoDate {
  const { ano, mes, dia } = parseIsoDate(iso);
  const d = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return montarIsoDate({ ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() });
}

/** "05/03/2026" → "2026-03-05" (null se inválida). */
export function parseDataBR(texto: string): IsoDate | null {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(texto);
  if (!m) return null;
  const iso = montarIsoDate({ ano: Number(m[3]), mes: Number(m[2]), dia: Number(m[1]) });
  return isIsoDate(iso) ? iso : null;
}

/** Competência "AAAA-MM" de uma data. */
export function competenciaDe(iso: IsoDate): string {
  return iso.slice(0, 7);
}

export const PERIODO_PRESETS = [
  'este_mes',
  'mes_passado',
  'ultimos_30_dias',
  'este_ano',
  'ano_passado',
  'personalizado',
] as const;
export type PeriodoPreset = (typeof PERIODO_PRESETS)[number];

export const PERIODO_PRESET_LABELS: Record<PeriodoPreset, string> = {
  este_mes: 'Este mês',
  mes_passado: 'Mês passado',
  ultimos_30_dias: 'Últimos 30 dias',
  este_ano: 'Este ano',
  ano_passado: 'Ano passado',
  personalizado: 'Personalizado',
};

export interface Periodo {
  de: IsoDate;
  ate: IsoDate;
}

/** Intervalo { de, ate } de um preset. "personalizado" devolve o mês atual como ponto de partida. */
export function periodoPreset(preset: PeriodoPreset, hoje: IsoDate = hojeSP()): Periodo {
  const { ano, mes } = parseIsoDate(hoje);
  const inicioMes = montarIsoDate({ ano, mes, dia: 1 });
  switch (preset) {
    case 'este_mes':
    case 'personalizado':
      return { de: inicioMes, ate: ultimoDiaDoMes(hoje) };
    case 'mes_passado': {
      const de = addMonthsClamp(inicioMes, -1);
      return { de, ate: ultimoDiaDoMes(de) };
    }
    case 'ultimos_30_dias':
      return { de: addDias(hoje, -29), ate: hoje };
    case 'este_ano':
      return {
        de: montarIsoDate({ ano, mes: 1, dia: 1 }),
        ate: montarIsoDate({ ano, mes: 12, dia: 31 }),
      };
    case 'ano_passado':
      return {
        de: montarIsoDate({ ano: ano - 1, mes: 1, dia: 1 }),
        ate: montarIsoDate({ ano: ano - 1, mes: 12, dia: 31 }),
      };
  }
}

/** Descobre qual preset corresponde ao intervalo (ou "personalizado"). */
export function presetDoPeriodo(periodo: Periodo, hoje: IsoDate = hojeSP()): PeriodoPreset {
  for (const preset of PERIODO_PRESETS) {
    if (preset === 'personalizado') continue;
    const p = periodoPreset(preset, hoje);
    if (p.de === periodo.de && p.ate === periodo.ate) return preset;
  }
  return 'personalizado';
}

/** "05/03/2026 – 31/03/2026" */
export function formatPeriodo(periodo: Periodo): string {
  return `${formatData(periodo.de)} – ${formatData(periodo.ate)}`;
}
