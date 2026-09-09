// Orquestra os estados de uma query (carregando / erro / vazio / dados) em um só lugar.
//   <QueryState query={query} skeleton={<PageSkeleton/>} isEmpty={(d) => d.data.length === 0}
//     empty={<EmptyState …/>}>{(dados) => <Lista dados={dados}/>}</QueryState>
import { type ReactNode } from 'react';

import { ErrorState } from './error-state';
import { SkeletonText } from './skeleton';

export interface QueryLike<T> {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
  isFetching?: boolean;
}

export interface QueryStateProps<T> {
  query: QueryLike<T>;
  children: (data: T) => ReactNode;
  skeleton?: ReactNode;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  errorTitle?: ReactNode;
  className?: string;
}

export function QueryState<T>({
  query,
  children,
  skeleton,
  isEmpty,
  empty,
  errorTitle,
  className,
}: QueryStateProps<T>) {
  if (query.isPending) {
    return <div className={className}>{skeleton ?? <SkeletonText linhas={4} />}</div>;
  }
  if (query.isError || query.data === undefined) {
    return (
      <div className={className}>
        <ErrorState
          titulo={errorTitle}
          error={query.error}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      </div>
    );
  }
  if (isEmpty?.(query.data) && empty) {
    return <div className={className}>{empty}</div>;
  }
  return <>{children(query.data)}</>;
}
