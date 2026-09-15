import { type HTMLAttributes } from 'react';

import { cn } from '@/lib/utils/cn';

/** Bloco de carregamento. Usa uma varredura de brilho (não "pisca") — em telas com muitas
 * linhas carregando ao mesmo tempo, o pulse de todas em uníssono chama mais atenção que o
 * conteúdo que está chegando. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-brilho rounded-md bg-zinc-200/70 bg-[length:220%_100%] bg-[linear-gradient(90deg,var(--color-zinc-200)_18%,var(--color-zinc-100)_38%,var(--color-zinc-200)_58%)]',
        className,
      )}
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
      <div className="space-y-2.5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-3.5 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
