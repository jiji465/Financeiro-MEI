import { type HTMLAttributes } from 'react';

import { cn } from '@/lib/utils/cn';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-zinc-200/80', className)}
      {...props}
    />
  );
}

/** Linhas de texto em skeleton (parágrafos, listas). */
export function SkeletonText({ linhas = 3, className }: { linhas?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: linhas }, (_, i) => (
        <Skeleton key={i} className={cn('h-4', i === linhas - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

/** Skeleton de página inteira (usado no Suspense do shell e no RequireAuth). */
export function PageSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-6" role="status" aria-label="Carregando">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
