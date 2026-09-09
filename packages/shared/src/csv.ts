// Leitura/escrita de CSV "brasileiro": BOM, ";" como separador padrão e vírgula decimal.
// Baseado em papaparse; sem dependências de Node (funciona no browser e na API).
import Papa from 'papaparse';

import { type IsoDate, isIsoDate, parseDataBR } from './dates.js';
import { type Centavos, formatDecimalBR, parseBRL } from './money.js';

export const BOM = '\uFEFF';

export type Delimitador = ';' | ',' | '\t' | '|';

export interface LinhaCsv {
  /** Número da linha no arquivo (1 = primeira linha de dados, após o cabeçalho). */
  numero: number;
  /** Valores por nome de coluna (cabeçalho), já sem espaços nas pontas. */
  campos: Record<string, string>;
}

export interface ResultadoCsv {
  delimitador: Delimitador;
  cabecalho: string[];
  linhas: LinhaCsv[];
  erros: { linha: number; mensagem: string }[];
}

/** Remove o BOM inicial, se houver. */
export function removerBom(texto: string): string {
  return texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
}

/** Descobre o separador olhando a primeira linha não vazia (";" tem prioridade sobre ","). */
export function detectarDelimitador(texto: string): Delimitador {
  const primeira = removerBom(texto)
    .split(/\r?\n/)
    .find((l) => l.trim() !== '');
  if (!primeira) return ';';
  const contar = (ch: string) => primeira.split(ch).length - 1;
  const candidatos: [Delimitador, number][] = [
    [';', contar(';')],
    ['\t', contar('\t')],
    ['|', contar('|')],
    [',', contar(',')],
  ];
  const melhor = candidatos.reduce((a, b) => (b[1] > a[1] ? b : a));
  return melhor[1] > 0 ? melhor[0] : ';';
}

/**
 * Faz o parse de um CSV com cabeçalho. Detecta ";" ou "," automaticamente, ignora linhas vazias,
 * remove BOM e devolve as linhas como mapa coluna → texto (sem conversão de tipos).
 */
export function parseCsvBrasileiro(texto: string, delimitador?: Delimitador): ResultadoCsv {
  const limpo = removerBom(texto ?? '');
  const delim = delimitador ?? detectarDelimitador(limpo);
  const resultado = Papa.parse<Record<string, string>>(limpo, {
    delimiter: delim,
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
    transform: (v) => (typeof v === 'string' ? v.trim() : v),
  });

  const cabecalho = (resultado.meta.fields ?? []).filter((f) => f !== '');
  const linhas: LinhaCsv[] = resultado.data.map((campos, i) => ({
    numero: i + 1,
    campos,
  }));
  const erros = resultado.errors
    .filter((e) => e.code !== 'UndetectableDelimiter')
    .map((e) => ({
      linha: typeof e.row === 'number' ? e.row + 1 : 0,
      mensagem: traduzirErroPapa(e.code, e.message),
    }));

  return { delimitador: delim, cabecalho, linhas, erros };
}

function traduzirErroPapa(code: string, original: string): string {
  switch (code) {
    case 'TooFewFields':
      return 'Linha com menos colunas que o cabeçalho';
    case 'TooManyFields':
      return 'Linha com mais colunas que o cabeçalho';
    case 'MissingQuotes':
      return 'Aspas não fechadas';
    case 'InvalidQuotes':
      return 'Aspas em posição inválida';
    default:
      return original;
  }
}

/**
 * Converte um número em formato brasileiro ("1.234,56", "R$ 1.234,56", "-12,5", "(12,50)")
 * ou americano ("1234.56") em centavos. Retorna null quando inválido.
 */
export function parseNumeroBrasileiro(texto: string): Centavos | null {
  return parseBRL(texto);
}

/**
 * Converte uma data em formato brasileiro (dd/MM/yyyy, dd/MM/yy, dd-MM-yyyy) ou ISO (yyyy-MM-dd)
 * em ISO. Retorna null quando inválida.
 */
export function parseDataBrasileira(texto: string): IsoDate | null {
  if (typeof texto !== 'string') return null;
  const t = texto.trim();
  if (isIsoDate(t)) return t;
  // ISO com hora (2026-03-01T10:00:00) → só a data
  const iso = /^(\d{4}-\d{2}-\d{2})[T ]/.exec(t);
  if (iso?.[1] && isIsoDate(iso[1])) return iso[1];
  return parseDataBR(t);
}

export type TipoColunaCsv = 'texto' | 'centavos' | 'data' | 'inteiro' | 'booleano';

export interface ColunaCsv<T> {
  /** Título no cabeçalho. */
  titulo: string;
  /** Chave do objeto ou função que extrai o valor bruto. */
  valor: keyof T | ((linha: T) => unknown);
  /** Como serializar: centavos → "1.234,56"; data → dd/MM/yyyy; booleano → Sim/Não. */
  tipo?: TipoColunaCsv;
}

export interface OpcoesToCsv {
  delimitador?: Delimitador;
  /** Inclui o BOM UTF-8 (padrão true; o Excel no Windows precisa dele para acentos). */
  bom?: boolean;
  /** Quebra de linha (padrão CRLF, o que o Excel espera). */
  quebraLinha?: '\r\n' | '\n';
}

function serializarCelula(valor: unknown, tipo: TipoColunaCsv | undefined): string {
  if (valor === null || valor === undefined) return '';
  switch (tipo) {
    case 'centavos':
      return typeof valor === 'number' ? formatDecimalBR(valor) : String(valor);
    case 'data':
      return typeof valor === 'string' && isIsoDate(valor)
        ? valor.slice(8, 10) + '/' + valor.slice(5, 7) + '/' + valor.slice(0, 4)
        : String(valor);
    case 'booleano':
      return valor ? 'Sim' : 'Não';
    case 'inteiro':
      return String(valor);
    default:
      if (typeof valor === 'number') return formatDecimalBR(valor);
      return String(valor);
  }
}

/**
 * Serializa linhas em CSV "brasileiro": BOM + ";" + vírgula decimal + CRLF, com cabeçalho.
 * Aspas e escape ficam por conta do papaparse.
 */
export function toCsv<T>(
  rows: readonly T[],
  columns: readonly ColunaCsv<T>[],
  opcoes: OpcoesToCsv = {},
): string {
  const delimitador = opcoes.delimitador ?? ';';
  const bom = opcoes.bom ?? true;
  const quebra = opcoes.quebraLinha ?? '\r\n';

  const fields = columns.map((c) => c.titulo);
  const data = rows.map((row) =>
    columns.map((c) => {
      const bruto = typeof c.valor === 'function' ? c.valor(row) : row[c.valor];
      return serializarCelula(bruto, c.tipo);
    }),
  );

  const corpo = Papa.unparse({ fields, data }, { delimiter: delimitador, newline: quebra }).replace(
    /\r?\n$/,
    '',
  );
  return (bom ? BOM : '') + corpo + quebra;
}
