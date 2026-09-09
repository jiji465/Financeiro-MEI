// Envoltório de gráficos Recharts: altura fixa, ResponsiveContainer, rótulo acessível
// e alternativa em tabela só para leitores de tela.
import { type ReactElement, type ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';

import { cn } from '@/lib/utils/cn';

import { Skeleton } from '../ui/skeleton';
import { VisuallyHidden } from '../ui/visually-hidden';

export interface ChartContainerProps {
  /** Descrição curta para aria-label (ex.: "Receitas e despesas por mês"). */
  titulo: string;
  /** Um gráfico do Recharts (BarChart, ComposedChart, PieChart…). */
  children: ReactElement;
  altura?: number;
  loading?: boolean;
  /** Tabela equivalente (sr-only) para acessibilidade. */
  tabela?: ReactNode;
  className?: string;
}

export function ChartContainer({
  titulo,
  children,
  altura = 280,
  loading,
  tabela,
  className,
}: ChartContainerProps) {
  if (loading) {
    return <Skeleton className={cn('w-full', className)} style={{ height: altura }} />;
  }
  return (
    <div className={cn('w-full', className)}>
      <div role="img" aria-label={titulo} style={{ height: altura }} className="w-full text-xs">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
      {tabela ? <VisuallyHidden>{tabela}</VisuallyHidden> : null}
    </div>
  );
}
