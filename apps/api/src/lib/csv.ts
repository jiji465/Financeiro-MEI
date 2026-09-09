// Exportação CSV "estilo Excel Brasil": BOM UTF-8, separador ";", vírgula decimal e CRLF.
// Embrulha o toCsv de @meifin/shared (fonte única da serialização) e acrescenta helpers de
// nome de arquivo/Content-Disposition usados pelos relatórios (WP5).
import { BOM, type ColunaCsv, toCsv } from '@meifin/shared';

export const CSV_BOM = BOM;
export const CSV_SEPARADOR = ';' as const;
export const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8';

export type { ColunaCsv } from '@meifin/shared';

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

/**
 * Gera o conteúdo do CSV (BOM + ";" + CRLF) a partir das colunas declaradas.
 * Tipos de coluna: 'centavos' → "1.234,56"; 'data' → dd/MM/aaaa; 'booleano' → Sim/Não.
 */
export function gerarCsv<T>(linhas: readonly T[], colunas: readonly ColunaCsv<T>[]): string {
  return toCsv(linhas, colunas, { delimitador: CSV_SEPARADOR, bom: true, quebraLinha: '\r\n' });
}

/** Buffer UTF-8 pronto para `reply.send` (o BOM já está no texto). */
export function bufferCsv<T>(linhas: readonly T[], colunas: readonly ColunaCsv<T>[]): Buffer {
  return Buffer.from(gerarCsv(linhas, colunas), 'utf8');
}

/**
 * Remove acentos e caracteres inválidos para nome de arquivo, mantendo o texto legível
 * ("Relatório DRE" → "Relatorio-DRE"). Sempre termina com a extensão informada.
 */
export function nomeArquivo(base: string, extensao: 'csv' | 'pdf'): string {
  const limpo = base
    .normalize('NFD')
    .replace(new RegExp('[\u0300-\u036f]', 'g'), '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${limpo || 'relatorio'}.${extensao}`;
}

/** Valor do cabeçalho Content-Disposition (attachment) com nome ASCII e variante UTF-8. */
export function contentDisposition(nome: string): string {
  const ascii = nome.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}
