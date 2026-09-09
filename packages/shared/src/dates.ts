// Datas de negócio são strings ISO "YYYY-MM-DD"; "hoje" é calculado em America/Sao_Paulo.
// Nunca usar new Date('YYYY-MM-DD') (interpreta como UTC e muda o dia no Brasil).
// Feriados e dias úteis ficam em domain/calendario.ts.
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

import { MESES_PT_BR, MESES_PT_BR_ABREV } from './constants.js';

export const TZ_SAO_PAULO = 'America/Sao_Paulo';

/** Data de negócio no formato AAAA-MM-DD. */
export type IsoDate = string;

/** Competência mensal no formato AAAA-MM. */
export type Competencia = string;

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const COMPETENCIA_RE = /^(\d{4})-(\d{2})$/;

const MS_POR_DIA = 86_400_000;

export function diasNoMes(ano: number, mes: number): number {
  // mês 1-12; dia 0 do mês seguinte = último dia do mês
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export function ehBissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

export function diasNoAno(ano: number): number {
  return ehBissexto(ano) ? 366 : 365;
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

export function isCompetencia(valor: unknown): valor is Competencia {
  if (typeof valor !== 'string') return false;
  const m = COMPETENCIA_RE.exec(valor);
  if (!m) return false;
  const mes = Number(m[2]);
  return mes >= 1 && mes <= 12;
}

export interface PartesData {
  ano: number;
  mes: number; // 1-12
  dia: number; // 1-31
}

export interface PartesCompetencia {
  ano: number;
  mes: number; // 1-12
}

/** Quebra AAAA-MM-DD em partes numéricas sem passar por Date (sem deslocamento de fuso). */
export function parseIsoDate(iso: IsoDate): PartesData {
  if (!isIsoDate(iso)) throw new RangeError(`Data inválida: ${iso}`);
  const [ano, mes, dia] = iso.split('-').map(Number) as [number, number, number];
  return { ano, mes, dia };
}

export function parseCompetencia(comp: Competencia): PartesCompetencia {
  if (!isCompetencia(comp)) throw new RangeError(`Competência inválida: ${comp}`);
  const [ano, mes] = comp.split('-').map(Number) as [number, number];
  return { ano, mes };
}

export function montarIsoDate({ ano, mes, dia }: PartesData): IsoDate {
  const mm = String(mes).padStart(2, '0');
  const dd = String(dia).padStart(2, '0');
  return `${String(ano).padStart(4, '0')}-${mm}-${dd}`;
}

export function montarCompetencia({ ano, mes }: PartesCompetencia): Competencia {
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}`;
}

/** Converte um instante para a data civil (AAAA-MM-DD) no fuso informado. */
export function toIsoDate(instante: Date, timeZone: string = TZ_SAO_PAULO): IsoDate {
  return format(new TZDate(instante, timeZone), 'yyyy-MM-dd');
}

/** "Hoje" em America/Sao_Paulo. Recebe o instante (relógio) para permitir relógio falso nos testes. */
export function hojeSP(agora: Date | (() => Date) = new Date()): IsoDate {
  const instante = typeof agora === 'function' ? agora() : agora;
  return toIsoDate(instante, TZ_SAO_PAULO);
}

/** Data ISO como Date em UTC meia-noite (só para aritmética; nunca exibir com getDate local). */
export function isoParaUtc(iso: IsoDate): Date {
  const { ano, mes, dia } = parseIsoDate(iso);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/** Dia da semana: 0 = domingo ... 6 = sábado. */
export function diaDaSemana(iso: IsoDate): number {
  return isoParaUtc(iso).getUTCDay();
}

export function ehFimDeSemana(iso: IsoDate): boolean {
  const d = diaDaSemana(iso);
  return d === 0 || d === 6;
}

/** Soma dias (pode ser negativo) a uma data ISO. */
export function addDias(iso: IsoDate, dias: number): IsoDate {
  const d = isoParaUtc(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return montarIsoDate({ ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() });
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

/** Soma meses a uma competência AAAA-MM. */
export function addMesesCompetencia(comp: Competencia, meses: number): Competencia {
  const { ano, mes } = parseCompetencia(comp);
  const indice = ano * 12 + (mes - 1) + meses;
  return montarCompetencia({ ano: Math.floor(indice / 12), mes: (indice % 12) + 1 });
}

/** Primeiro dia do mês da data. */
export function primeiroDiaDoMes(iso: IsoDate): IsoDate {
  const { ano, mes } = parseIsoDate(iso);
  return montarIsoDate({ ano, mes, dia: 1 });
}

/** Último dia do mês da data. */
export function ultimoDiaDoMes(iso: IsoDate): IsoDate {
  const { ano, mes } = parseIsoDate(iso);
  return montarIsoDate({ ano, mes, dia: diasNoMes(ano, mes) });
}

/** Alias: início do mês (AAAA-MM-01). Aceita data ISO ou competência AAAA-MM. */
export function inicioMes(isoOuCompetencia: IsoDate | Competencia): IsoDate {
  if (isCompetencia(isoOuCompetencia)) {
    const { ano, mes } = parseCompetencia(isoOuCompetencia);
    return montarIsoDate({ ano, mes, dia: 1 });
  }
  return primeiroDiaDoMes(isoOuCompetencia);
}

/** Alias: fim do mês. Aceita data ISO ou competência AAAA-MM. */
export function fimMes(isoOuCompetencia: IsoDate | Competencia): IsoDate {
  if (isCompetencia(isoOuCompetencia)) {
    const { ano, mes } = parseCompetencia(isoOuCompetencia);
    return montarIsoDate({ ano, mes, dia: diasNoMes(ano, mes) });
  }
  return ultimoDiaDoMes(isoOuCompetencia);
}

export function inicioAno(ano: number): IsoDate {
  return montarIsoDate({ ano, mes: 1, dia: 1 });
}

export function fimAno(ano: number): IsoDate {
  return montarIsoDate({ ano, mes: 12, dia: 31 });
}

/** Competência (AAAA-MM) de uma data ISO. */
export function competenciaDe(iso: IsoDate): Competencia {
  const { ano, mes } = parseIsoDate(iso);
  return montarCompetencia({ ano, mes });
}

/** Ano (número) de uma data ISO. */
export function anoDe(iso: IsoDate): number {
  return parseIsoDate(iso).ano;
}

/** Diferença em dias (b − a); negativa se b < a. */
export function diasEntre(a: IsoDate, b: IsoDate): number {
  return Math.round((isoParaUtc(b).getTime() - isoParaUtc(a).getTime()) / MS_POR_DIA);
}

/** Diferença em meses inteiros de calendário entre as competências das datas (b − a). */
export function mesesEntre(a: IsoDate | Competencia, b: IsoDate | Competencia): number {
  const pa = isCompetencia(a) ? parseCompetencia(a) : parseIsoDate(a);
  const pb = isCompetencia(b) ? parseCompetencia(b) : parseIsoDate(b);
  return (pb.ano - pa.ano) * 12 + (pb.mes - pa.mes);
}

/** Lista de competências de `de` até `ate` (inclusive), em ordem crescente. */
export function competenciasEntre(de: Competencia, ate: Competencia): Competencia[] {
  const total = mesesEntre(de, ate);
  if (total < 0) return [];
  const lista: Competencia[] = [];
  for (let i = 0; i <= total; i++) lista.push(addMesesCompetencia(de, i));
  return lista;
}

/** Comparação lexicográfica é válida para ISO; retorna -1, 0 ou 1. */
export function compararIsoDate(a: IsoDate, b: IsoDate): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function maxIsoDate(a: IsoDate, b: IsoDate): IsoDate {
  return a >= b ? a : b;
}

export function minIsoDate(a: IsoDate, b: IsoDate): IsoDate {
  return a <= b ? a : b;
}

/** true quando `iso` está em [de, ate] (inclusivo). */
export function dentroDoPeriodo(iso: IsoDate, de: IsoDate, ate: IsoDate): boolean {
  return iso >= de && iso <= ate;
}

/** dd/MM/yyyy */
export function formatData(iso: IsoDate): string {
  const { ano, mes, dia } = parseIsoDate(iso);
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
}

/** "Março/2026" (ou "mar/2026" com abreviado=true). Aceita ISO ou competência. */
export function formatMesAno(isoOuCompetencia: IsoDate | Competencia, abreviado = false): string {
  const { ano, mes } = isCompetencia(isoOuCompetencia)
    ? parseCompetencia(isoOuCompetencia)
    : parseIsoDate(isoOuCompetencia);
  const nome = abreviado ? MESES_PT_BR_ABREV[mes - 1] : MESES_PT_BR[mes - 1];
  return `${nome}/${ano}`;
}

/** Nome do mês em pt-BR (1-12). */
export function nomeDoMes(mes: number, abreviado = false): string {
  const nome = abreviado ? MESES_PT_BR_ABREV[mes - 1] : MESES_PT_BR[mes - 1];
  if (nome === undefined) throw new RangeError(`Mês inválido: ${mes}`);
  return nome;
}

/** Converte dd/MM/yyyy (ou dd/MM/yy, d/M/yyyy, com "-" ou ".") em ISO; null se inválida. */
export function parseDataBR(texto: string): IsoDate | null {
  if (typeof texto !== 'string') return null;
  const m = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\s*$/.exec(texto);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  let ano = Number(m[3]);
  if (m[3]?.length === 2) ano += ano < 70 ? 2000 : 1900;
  const iso = montarIsoDate({ ano, mes, dia });
  return isIsoDate(iso) ? iso : null;
}
