// Exportação CSV "estilo Excel Brasil": BOM UTF-8, separador ";" e vírgula decimal.
// Base do P1-B; WP5 (relatórios) amplia com colunas específicas por relatório.
import Papa from 'papaparse';

export const CSV_BOM = '\uFEFF';
export const CSV_SEPARADOR = ';';

export interface ColunaCsv<T> {
  titulo: string;
  valor: (linha: T) => string | number | boolean | null | undefined;
}

/** 123456 → "1234,56" (sem símbolo, vírgula decimal, sem separador de milhar). */
export function formatarCentavosCsv(centavos: number): string {
  const negativo = centavos < 0;
  const abs = Math.abs(Math.trunc(centavos));
  const inteiro = Math.floor(abs / 100);
  const fracao = String(abs % 100).padStart(2, '0');
  return `${negativo ? '-' : ''}${inteiro},${fracao}`;
}

/** AAAA-MM-DD → DD/MM/AAAA (datas vazias viram ""). */
export function formatarDataCsv(iso: string | null | undefined): string {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
}

function celula(valor: string | number | boolean | null | undefined): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number') return String(valor).replace('.', ',');
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  return valor;
}

/** Gera o conteúdo do CSV (com BOM). Salve como text/csv; charset=utf-8. */
export function gerarCsv<T>(linhas: readonly T[], colunas: readonly ColunaCsv<T>[]): string {
  const fields = colunas.map((c) => c.titulo);
  const data = linhas.map((linha) => colunas.map((c) => celula(c.valor(linha))));
  const corpo = Papa.unparse({ fields, data }, { delimiter: CSV_SEPARADOR, newline: '\r\n' });
  return CSV_BOM + corpo + '\r\n';
}

export const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8';
