import * as ProgressPrimitive from '@radix-ui/react-progress';
import { type ComponentProps } from 'react';

import { cn } from '@/lib/utils/cn';

export interface ProgressMarker {
  /** Posição do marcador em percentual (0-100). */
  valor: number;
  label?: string;
}

export type ProgressTone = 'primary' | 'receita' | 'alerta' | 'perigo' | 'neutral';

export interface ProgressProps extends Omit<
  ComponentProps<typeof ProgressPrimitive.Root>,
  'value'
> {
  /** Percentual 0-100 (valores acima de 100 são exibidos cheios). */
  value: number;
  tone?: ProgressTone;
  /** Marcas verticais (ex.: 70/85/100 do limite MEI). */
  markers?: ProgressMarker[];
  /** Altura da barra. */
  size?: 'sm' | 'md' | 'lg';
}

const TONE_CLASS: Record<ProgressTone, string> = {
  primary: 'bg-primary-600',
  receita: 'bg-receita-600',
  alerta: 'bg-alerta-500',
  perigo: 'bg-perigo-600',
  neutral: 'bg-zinc-400',
};

/** Tom sugerido para percentuais de limite (ok / atenção / alerta / estourado). */
export function toneDoPercentual(pct: number): ProgressTone {
  if (pct >= 100) return 'perigo';
  if (pct >= 85) return 'perigo';
  if (pct >= 70) return 'alerta';
  return 'receita';
}

export function Progress({
  className,
  value,
  tone = 'primary',
  markers,
  size = 'md',
  ...props
}: ProgressProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('w-full', markers?.some((m) => m.label) && 'pb-4')}>
      <ProgressPrimitive.Root
        className={cn(
          'relative w-full overflow-visible rounded-full bg-zinc-200',
          size === 'sm' && 'h-1.5',
          size === 'md' && 'h-2.5',
          size === 'lg' && 'h-4',
          className,
        )}
        value={pct}
        max={100}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn('h-full rounded-full transition-[width] duration-500', TONE_CLASS[tone])}
          style={{ width: `${pct}%` }}
        />
        {markers?.map((m) => (
          <span
            key={m.valor}
            aria-hidden="true"
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${Math.max(0, Math.min(100, m.valor))}%` }}
          >
            <span className="block h-[calc(100%+8px)] min-h-4 w-0.5 bg-zinc-500/70" />
            {m.label ? (
              <span className="absolute top-full left-1/2 mt-1 -translate-x-1/2 text-[10px] leading-none whitespace-nowrap text-zinc-500">
                {m.label}
              </span>
            ) : null}
          </span>
        ))}
      </ProgressPrimitive.Root>
    </div>
  );
}
