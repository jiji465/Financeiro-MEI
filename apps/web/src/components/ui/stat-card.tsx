import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { type ReactNode } from 'react';

import { formatPercentual } from '@/lib/format/money';
import { cn } from '@/lib/utils/cn';

import { Card } from './card';
import { Skeleton } from './skeleton';

export interface StatDelta {
  /** Variação percentual em relação ao período anterior (ex.: 12.5 = +12,5%). */
  percentual: number | null;
  /** Texto após o percentual (ex.: "vs. mês anterior"). */
  descricao?: string;
  /** Se true, uma alta é boa (receitas); se false, uma alta é ruim (despesas). Padrão: true. */
  altaEhBoa?: boolean;
}

export type StatTone = 'neutral' | 'primary' | 'receita' | 'despesa' | 'alerta';

export interface StatCardProps {
  titulo: ReactNode;
  valor: ReactNode;
  delta?: StatDelta;
  icone?: ReactNode;
  tone?: StatTone;
  /** Linha auxiliar abaixo do valor. */
  rodape?: ReactNode;
  loading?: boolean;
  className?: string;
  /** Torna o card clicável (link/botão envolvente é responsabilidade do chamador). */
  onClick?: () => void;
}

const TONE_ICON: Record<StatTone, string> = {
  neutral: 'bg-zinc-100 text-zinc-600',
  primary: 'bg-primary-50 text-primary-700',
  receita: 'bg-receita-50 text-receita-700',
  despesa: 'bg-despesa-50 text-despesa-700',
  alerta: 'bg-alerta-50 text-alerta-700',
};

const TONE_VALOR: Record<StatTone, string> = {
  neutral: 'text-texto',
  primary: 'text-primary-800',
  receita: 'text-receita-700',
  despesa: 'text-despesa-700',
  alerta: 'text-alerta-700',
};

function Delta({ delta }: { delta: StatDelta }) {
  if (delta.percentual === null || !Number.isFinite(delta.percentual)) {
    return <span className="text-xs text-zinc-500">{delta.descricao ?? 'Sem comparação'}</span>;
  }
  const altaEhBoa = delta.altaEhBoa ?? true;
  const subiu = delta.percentual > 0;
  const estavel = delta.percentual === 0;
  const bom = estavel ? null : subiu === altaEhBoa;
  const Icone = estavel ? Minus : subiu ? TrendingUp : TrendingDown;
  const sinal = subiu ? '+' : '';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium tabular-nums',
        bom === null && 'text-zinc-500',
        bom === true && 'text-receita-700',
        bom === false && 'text-despesa-700',
      )}
    >
      <Icone className="size-3.5" aria-hidden="true" />
      {sinal}
      {formatPercentual(delta.percentual)}
      {delta.descricao ? (
        <span className="font-normal text-zinc-500"> {delta.descricao}</span>
      ) : null}
    </span>
  );
}

export function StatCard({
  titulo,
  valor,
  delta,
  icone,
  tone = 'neutral',
  rodape,
  loading,
  className,
  onClick,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        'p-4 md:p-5',
        onClick && 'cursor-pointer transition-colors hover:bg-zinc-50',
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-zinc-500">{titulo}</p>
        {icone ? (
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-5',
              TONE_ICON[tone],
            )}
          >
            {icone}
          </span>
        ) : null}
      </div>
      {loading ? (
        <div className="mt-2 space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      ) : (
        <>
          <p
            className={cn('mt-1 text-2xl font-bold tracking-tight tabular-nums', TONE_VALOR[tone])}
          >
            {valor}
          </p>
          {delta ? (
            <div className="mt-1">
              <Delta delta={delta} />
            </div>
          ) : null}
          {rodape ? <p className="mt-1 text-xs text-zinc-500">{rodape}</p> : null}
        </>
      )}
    </Card>
  );
}
