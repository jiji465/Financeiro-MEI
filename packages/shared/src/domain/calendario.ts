// Feriados nacionais e dias úteis (usados no vencimento do DAS e no calendário de obrigações).
// Fixos: 01/01, 21/04, 01/05, 07/09, 12/10, 02/11, 15/11, 20/11 (Lei 14.759/2023), 25/12.
// Móveis a partir da Páscoa (Meeus/Jones/Butcher): Carnaval (−48 e −47), Sexta-feira Santa (−2), Corpus Christi (+60).
import { addDias, ehFimDeSemana, type IsoDate, montarIsoDate, parseIsoDate } from '../dates.js';

export interface Feriado {
  data: IsoDate;
  nome: string;
  /** true para os que dependem da Páscoa. */
  movel: boolean;
}

const FERIADOS_FIXOS: readonly { mes: number; dia: number; nome: string; desde?: number }[] = [
  { mes: 1, dia: 1, nome: 'Confraternização Universal' },
  { mes: 4, dia: 21, nome: 'Tiradentes' },
  { mes: 5, dia: 1, nome: 'Dia do Trabalho' },
  { mes: 9, dia: 7, nome: 'Independência do Brasil' },
  { mes: 10, dia: 12, nome: 'Nossa Senhora Aparecida' },
  { mes: 11, dia: 2, nome: 'Finados' },
  { mes: 11, dia: 15, nome: 'Proclamação da República' },
  { mes: 11, dia: 20, nome: 'Dia Nacional de Zumbi e da Consciência Negra', desde: 2024 },
  { mes: 12, dia: 25, nome: 'Natal' },
];

/** Domingo de Páscoa pelo algoritmo de Meeus/Jones/Butcher (calendário gregoriano). */
export function pascoa(ano: number): IsoDate {
  if (!Number.isInteger(ano) || ano < 1583)
    throw new RangeError(`Ano inválido para a Páscoa: ${ano}`);
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return montarIsoDate({ ano, mes, dia });
}

const cache = new Map<number, Feriado[]>();

/** Feriados nacionais do ano (fixos + móveis), ordenados por data. Resultado é cacheado; não mutar. */
export function feriadosNacionais(ano: number): readonly Feriado[] {
  const existente = cache.get(ano);
  if (existente) return existente;

  const domingoPascoa = pascoa(ano);
  const lista: Feriado[] = FERIADOS_FIXOS.filter(
    (f) => f.desde === undefined || ano >= f.desde,
  ).map((f) => ({
    data: montarIsoDate({ ano, mes: f.mes, dia: f.dia }),
    nome: f.nome,
    movel: false,
  }));
  lista.push(
    { data: addDias(domingoPascoa, -48), nome: 'Carnaval (segunda-feira)', movel: true },
    { data: addDias(domingoPascoa, -47), nome: 'Carnaval (terça-feira)', movel: true },
    { data: addDias(domingoPascoa, -2), nome: 'Sexta-feira Santa', movel: true },
    { data: addDias(domingoPascoa, 60), nome: 'Corpus Christi', movel: true },
  );
  lista.sort((x, y) => (x.data < y.data ? -1 : x.data > y.data ? 1 : 0));
  cache.set(ano, lista);
  return lista;
}

/** Feriado nacional na data, ou null. */
export function feriadoEm(iso: IsoDate): Feriado | null {
  const { ano } = parseIsoDate(iso);
  return feriadosNacionais(ano).find((f) => f.data === iso) ?? null;
}

export function ehFeriado(iso: IsoDate): boolean {
  return feriadoEm(iso) !== null;
}

/** Dia útil = não é sábado/domingo nem feriado nacional. */
export function ehDiaUtil(iso: IsoDate): boolean {
  return !ehFimDeSemana(iso) && !ehFeriado(iso);
}

/** A própria data se for dia útil; senão o próximo dia útil. */
export function proximoDiaUtil(iso: IsoDate): IsoDate {
  let atual = iso;
  // Limite defensivo: nunca há mais de alguns dias seguidos sem dia útil.
  for (let i = 0; i < 15; i++) {
    if (ehDiaUtil(atual)) return atual;
    atual = addDias(atual, 1);
  }
  /* v8 ignore next */
  throw new Error(`Não foi possível encontrar dia útil após ${iso}`);
}

/** A própria data se for dia útil; senão o dia útil anterior. */
export function diaUtilAnterior(iso: IsoDate): IsoDate {
  let atual = iso;
  for (let i = 0; i < 15; i++) {
    if (ehDiaUtil(atual)) return atual;
    atual = addDias(atual, -1);
  }
  /* v8 ignore next */
  throw new Error(`Não foi possível encontrar dia útil antes de ${iso}`);
}

/** Quantidade de dias úteis em [de, ate] (inclusivo). */
export function contarDiasUteis(de: IsoDate, ate: IsoDate): number {
  let total = 0;
  for (let atual = de; atual <= ate; atual = addDias(atual, 1)) {
    if (ehDiaUtil(atual)) total++;
  }
  return total;
}
