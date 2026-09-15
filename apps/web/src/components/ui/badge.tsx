import { cva, type VariantProps } from 'class-variance-authority';
import { type HTMLAttributes } from 'react';

import { cn } from '@/lib/utils/cn';

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2 py-px text-[0.6875rem] leading-5 font-medium whitespace-nowrap valor [&_svg]:size-3',
  {
    variants: {
      tone: {
        neutral: 'border-zinc-200 bg-zinc-50 text-zinc-700',
        primary: 'border-primary-200 bg-primary-50 text-primary-800',
        receita: 'border-receita-100 bg-receita-50 text-receita-700',
        despesa: 'border-despesa-100 bg-despesa-50 text-despesa-700',
        alerta: 'border-alerta-100 bg-alerta-50 text-alerta-700',
        info: 'border-info-100 bg-info-50 text-info-700',
        outline: 'border-borda bg-transparent text-zinc-600',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  /** Bolinha colorida à esquerda (status). */
  dot?: boolean;
}

export function Badge({ className, tone, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot ? (
        <span aria-hidden="true" className="-ml-0.5 size-1.5 rounded-full bg-current opacity-80" />
      ) : null}
      {children}
    </span>
  );
}
