// Tabela de dados: tabela no desktop, cartões no mobile (quando `mobileCard` é informado),
// com estados de carregamento (skeleton), erro (+ tentar novamente) e vazio.
import { type ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

import { ErrorState } from './error-state';
import { Skeleton } from './skeleton';

export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl';

const HIDE_BELOW: Record<Breakpoint, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
};

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  /** Esconde a coluna abaixo do breakpoint. */
  hideBelow?: Breakpoint;
  align?: 'left' | 'center' | 'right';
  /** Classe aplicada a th e td (largura, truncamento…). */
  className?: string;
  /** Valores numéricos: alinha à direita e usa tabular-nums. */
  numeric?: boolean;
}

export interface DataTableProps<T> {
  columns: readonly DataTableColumn<T>[];
  data: readonly T[] | undefined;
  rowKey: (row: T, index: number) => string;
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Conteúdo exibido quando não há linhas (normalmente <EmptyState/>). */
  empty?: ReactNode;
  /** Renderização como cartão abaixo de md. Sem ele, a tabela rola horizontalmente. */
  mobileCard?: (row: T, index: number) => ReactNode;
  /** Ações por linha (menu, botões), exibidas na última coluna e no cartão mobile. */
  rowActions?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  footer?: ReactNode;
  caption?: string;
  skeletonRows?: number;
  className?: string;
  /** Classe extra por linha (ex.: destacar vencidos). */
  rowClassName?: (row: T) => string | undefined;
}

function alinhamento<T>(col: DataTableColumn<T>): string {
  if (col.numeric || col.align === 'right') return 'text-right tabular-nums';
  if (col.align === 'center') return 'text-center';
  return 'text-left';
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  isLoading,
  isError,
  error,
  onRetry,
  empty,
  mobileCard,
  rowActions,
  onRowClick,
  footer,
  caption,
  skeletonRows = 5,
  className,
  rowClassName,
}: DataTableProps<T>) {
  const linhas = data ?? [];
  const vazio = !isLoading && !isError && linhas.length === 0;
  const totalColunas = columns.length + (rowActions ? 1 : 0);

  if (isError) {
    return (
      <div className={className}>
        <ErrorState error={error} onRetry={onRetry} />
      </div>
    );
  }

  if (vazio) {
    return (
      <div className={className}>
        {empty ?? <p className="py-10 text-center text-sm text-zinc-500">Nenhum registro.</p>}
      </div>
    );
  }

  const tabela = (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm md:min-w-0">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-borda text-xs text-zinc-500">
            {columns.map((col) => (
              <th
                key={col.id}
                scope="col"
                className={cn(
                  'px-3 py-2 font-medium whitespace-nowrap',
                  alinhamento(col),
                  col.hideBelow && HIDE_BELOW[col.hideBelow],
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
            {rowActions ? (
              <th scope="col" className="w-12 px-3 py-2">
                <span className="sr-only">Ações</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: skeletonRows }, (_, i) => (
                <tr key={`sk-${i}`} className="border-b border-borda" aria-hidden="true">
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={cn('px-3 py-3', col.hideBelow && HIDE_BELOW[col.hideBelow])}
                    >
                      <Skeleton className="h-4 w-full max-w-40" />
                    </td>
                  ))}
                  {rowActions ? <td className="px-3 py-3" /> : null}
                </tr>
              ))
            : linhas.map((row, index) => (
                <tr
                  key={rowKey(row, index)}
                  className={cn(
                    'border-b border-borda last:border-0',
                    onRowClick && 'cursor-pointer hover:bg-zinc-50',
                    rowClassName?.(row),
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={cn(
                        'px-3 py-3 align-middle',
                        alinhamento(col),
                        col.hideBelow && HIDE_BELOW[col.hideBelow],
                        col.className,
                      )}
                    >
                      {col.cell(row, index)}
                    </td>
                  ))}
                  {rowActions ? (
                    <td className="px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      {rowActions(row)}
                    </td>
                  ) : null}
                </tr>
              ))}
        </tbody>
        {footer ? (
          <tfoot>
            <tr className="border-t border-borda bg-zinc-50 text-sm font-medium">
              <td colSpan={totalColunas} className="px-3 py-2">
                {footer}
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );

  if (!mobileCard) return <div className={className}>{tabela}</div>;

  return (
    <div className={className}>
      <div className="hidden md:block">{tabela}</div>
      <div className="md:hidden">
        {isLoading ? (
          <ul className="space-y-2" aria-hidden="true">
            {Array.from({ length: Math.min(skeletonRows, 4) }, (_, i) => (
              <li key={i} className="rounded-lg border border-borda bg-superficie p-3">
                <Skeleton className="mb-2 h-4 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-2" aria-label={caption}>
            {linhas.map((row, index) => (
              <li
                key={rowKey(row, index)}
                className={cn(
                  'flex items-start gap-2 rounded-lg border border-borda bg-superficie p-3',
                  onRowClick && 'cursor-pointer active:bg-zinc-50',
                  rowClassName?.(row),
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                <div className="min-w-0 flex-1">{mobileCard(row, index)}</div>
                {rowActions ? (
                  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    {rowActions(row)}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {footer && !isLoading ? (
          <div className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm font-medium">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
