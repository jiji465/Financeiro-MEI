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

/** Tamanho do número. `lg` é para o número principal de uma tela (um por tela). */
export type StatTamanho = 'sm' | 'md' | 'lg';

export interface StatCardProps {
  titulo: ReactNode;
  valor: ReactNode;
  delta?: StatDelta;
  icone?: ReactNode;
  tone?: StatTone;
  tamanho?: StatTamanho;
  /** Linha auxiliar abaixo do valor. */
  rodape?: ReactNode;
  loading?: boolean;
  className?: string;
  /** Sem borda/sombra — para usar dentro de um card maior (painel de resumo). */
  semCard?: boolean;
  /** Torna o card clicável (link/botão envolvente é responsabilidade do chamador). */
  onClick?: () => void;
}

/** Bolinha de categoria antes do rótulo: dá significado (verde = receita) sem pintar o número
 * inteiro nem gastar um ícone colorido grande. */
const TONE_PONTO: Record<StatTone, string | null> = {
  neutral: null,
  primary: null,
  receita: 'bg-receita-500',
  despesa: 'bg-despesa-500',
  alerta: 'bg-alerta-500',
};

const TONE_VALOR: Record<StatTone, string> = {
  neutral: 'text-texto',
  primary: 'text-texto',
  receita: 'text-receita-700',
  despesa: 'text-despesa-700',
  alerta: 'text-alerta-700',
};

const TAMANHO_VALOR: Record<StatTamanho, string> = {
  sm: 'text-lg md:text-xl',
  md: 'text-2xl',
  lg: 'text-3xl md:text-4xl',
};

const TAMANHO_SKELETON: Record<StatTamanho, string> = {
  sm: 'h-6 w-24',
  md: 'h-8 w-32',
  lg: 'h-10 w-44',
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
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className={cn(
          'inline-flex items-center gap-0.5 rounded-sm px-1 py-px font-medium valor',
          bom === null && 'bg-zinc-100 text-zinc-600',
          bom === true && 'bg-receita-50 text-receita-700',
          bom === false && 'bg-despesa-50 text-despesa-700',
        )}
      >
        <Icone className="size-3" aria-hidden="true" />
        {sinal}
        {formatPercentual(delta.percentual)}
      </span>
      {delta.descricao ? <span className="text-zinc-500">{delta.descricao}</span> : null}
    </span>
  );
}

export function StatCard({
  titulo,
  valor,
  delta,
  icone,
  tone = 'neutral',
  tamanho = 'md',
  rodape,
  loading,
  className,
  semCard,
  onClick,
}: StatCardProps) {
  const ponto = TONE_PONTO[tone];
  const conteudo = (
    <>
      <div className="flex items-center gap-2">
        {ponto ? (
          <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', ponto)} />
        ) : null}
        <p className="min-w-0 truncate text-[0.8125rem] leading-5 font-medium text-zinc-500">
          {titulo}
        </p>
        {icone ? (
          <span className="ml-auto shrink-0 text-zinc-400 [&_svg]:size-4" aria-hidden="true">
            {icone}
          </span>
        ) : null}
      </div>
      {loading ? (
        <div className="mt-2 space-y-2">
          <Skeleton className={TAMANHO_SKELETON[tamanho]} />
          <Skeleton className="h-3 w-28" />
        </div>
      ) : (
        <>
          <p className={cn('mt-1.5 font-semibold valor', TAMANHO_VALOR[tamanho], TONE_VALOR[tone])}>
            {valor}
          </p>
          {delta || rodape ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              {delta ? <Delta delta={delta} /> : null}
              {rodape ? <p className="text-xs text-zinc-500">{rodape}</p> : null}
            </div>
          ) : null}
        </>
      )}
    </>
  );

  if (semCard) {
    return <div className={className}>{conteudo}</div>;
  }

  return (
    <Card
      interativo={Boolean(onClick)}
      className={cn('p-4 md:p-5', onClick && 'cursor-pointer', className)}
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
      {conteudo}
    </Card>
  );
}
