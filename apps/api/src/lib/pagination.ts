// Paginação padrão da API: listas devolvem { data, meta: { page, pageSize, total } }.
import { PAGINACAO, type PaginationMeta } from '@meifin/shared';

export interface Paginacao {
  page: number;
  pageSize: number;
}

export interface Paginado<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Normaliza page/pageSize vindos de query string (já validados por zod na rota, mas defensivo). */
export function parsePaginacao(query: { page?: unknown; pageSize?: unknown } = {}): Paginacao {
  const page = Math.max(1, Math.trunc(Number(query.page) || 1));
  const bruto = Math.trunc(Number(query.pageSize) || PAGINACAO.pageSizePadrao);
  const pageSize = Math.min(PAGINACAO.pageSizeMax, Math.max(1, bruto));
  return { page, pageSize };
}

export function offsetDe({ page, pageSize }: Paginacao): number {
  return (page - 1) * pageSize;
}

export function paginado<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): Paginado<T> {
  return { data: items, meta: { page, pageSize, total } };
}
