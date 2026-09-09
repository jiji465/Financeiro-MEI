// Datas de negócio são strings ISO "YYYY-MM-DD"; "hoje" é calculado em America/Sao_Paulo.
// Nunca usar new Date('YYYY-MM-DD') (interpreta como UTC e muda o dia no Brasil).
// P1-A (Shared) amplia este arquivo com feriados, dia útil e demais utilitários.
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

export const TZ_SAO_PAULO = 'America/Sao_Paulo';

/** Data de negócio no formato AAAA-MM-DD. */
export type IsoDate = string;

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function diasNoMes(ano: number, mes: number): number {
  // mês 1-12; dia 0 do mês seguinte = último dia do mês
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export function isIsoDate(valor: unknown): valor is IsoDate {
  if (typeof valor !== 'string') return false;
  const m = ISO_DATE_RE.exec(valor);
  if (!m) return false;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  return mes >= 1 && mes <= 12 && dia >= 1 && dia <= diasNoMes(ano, mes);
}

export interface PartesData {
  ano: number;
  mes: number; // 1-12
  dia: number; // 1-31
}

export function parseIsoDate(iso: IsoDate): PartesData {
  if (!isIsoDate(iso)) throw new RangeError(`Data inválida: ${iso}`);
  const [ano, mes, dia] = iso.split('-').map(Number) as [number, number, number];
  return { ano, mes, dia };
}

export function montarIsoDate({ ano, mes, dia }: PartesData): IsoDate {
  const mm = String(mes).padStart(2, '0');
  const dd = String(dia).padStart(2, '0');
  return `${String(ano).padStart(4, '0')}-${mm}-${dd}`;
}

/** Converte um instante para a data civil (AAAA-MM-DD) no fuso informado. */
export function toIsoDate(instante: Date, timeZone: string = TZ_SAO_PAULO): IsoDate {
  return format(new TZDate(instante, timeZone), 'yyyy-MM-dd');
}

/** "Hoje" em America/Sao_Paulo. Recebe o instante para permitir relógio falso nos testes. */
export function hojeSP(agora: Date = new Date()): IsoDate {
  return toIsoDate(agora, TZ_SAO_PAULO);
}

/**
 * Soma meses a uma data ISO mantendo o dia quando possível e "grudando" no fim do mês
 * quando o dia não existe (31/01 + 1 mês = 28/02 ou 29/02). Usado em parcelas e recorrências.
 */
export function addMonthsClamp(iso: IsoDate, meses: number): IsoDate {
  const { ano, mes, dia } = parseIsoDate(iso);
  const indice = ano * 12 + (mes - 1) + meses;
  const novoAno = Math.floor(indice / 12);
  const novoMes = (indice % 12) + 1;
  const novoDia = Math.min(dia, diasNoMes(novoAno, novoMes));
  return montarIsoDate({ ano: novoAno, mes: novoMes, dia: novoDia });
}

/** Primeiro dia do mês da data (competência). */
export function primeiroDiaDoMes(iso: IsoDate): IsoDate {
  const { ano, mes } = parseIsoDate(iso);
  return montarIsoDate({ ano, mes, dia: 1 });
}

/** Último dia do mês da data. */
export function ultimoDiaDoMes(iso: IsoDate): IsoDate {
  const { ano, mes } = parseIsoDate(iso);
  return montarIsoDate({ ano, mes, dia: diasNoMes(ano, mes) });
}

/** Comparação lexicográfica é válida para ISO; retorna -1, 0 ou 1. */
export function compararIsoDate(a: IsoDate, b: IsoDate): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}
