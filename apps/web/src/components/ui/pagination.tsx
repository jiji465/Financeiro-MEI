import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils/cn';

import { Button } from './button';
import { SimpleSelect } from './select';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
  className?: string;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [20, 50, 100],
  className,
}: PaginationProps) {
  const totalPaginas = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const inicio = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const fim = Math.min(total, page * pageSize);

  if (total <= pageSize && !onPageSizeChange) return null;

  return (
    <nav
      aria-label="Paginação"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600',
        className,
      )}
    >
      <p className="tabular-nums">
        {total === 0 ? 'Nenhum registro' : `${inicio}–${fim} de ${total.toLocaleString('pt-BR')}`}
      </p>
      <div className="flex items-center gap-2">
        {onPageSizeChange ? (
          <div className="w-28">
            <SimpleSelect
              aria-label="Itens por página"
              value={String(pageSize)}
              onValueChange={(v) => v && onPageSizeChange(Number(v))}
              options={pageSizeOptions.map((n) => ({ value: String(n), label: `${n} / pág.` }))}
            />
          </div>
        ) : null}
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Página anterior"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft />
        </Button>
        <span className="min-w-16 text-center tabular-nums" aria-live="polite">
          {page} de {totalPaginas}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Próxima página"
          disabled={page >= totalPaginas}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
