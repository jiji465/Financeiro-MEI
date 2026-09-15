import { type HTMLAttributes } from 'react';

import { cn } from '@/lib/utils/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Card que responde ao mouse (link, atalho, item selecionável). */
  interativo?: boolean;
}

export function Card({ className, interativo, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-borda bg-superficie text-texto shadow-card',
        interativo &&
          'transition-[box-shadow,border-color] duration-150 hover:border-borda-forte hover:shadow-card-hover',
        className,
      )}
      {...props}
    />
  );
}

/** Cabeçalho do card. O respiro até o conteúdo vem do padding do CardContent — não acumule
 * padding-bottom aqui, senão cards com e sem cabeçalho ficam com espaçamentos diferentes. */
export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col gap-0.5 px-4 pt-4 pb-0 md:px-5 md:pt-5 md:pb-0', className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-[0.9375rem] leading-tight font-semibold text-texto', className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm leading-snug text-zinc-500', className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 md:p-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center gap-2 border-t border-linha px-4 py-3 md:px-5', className)}
      {...props}
    />
  );
}
