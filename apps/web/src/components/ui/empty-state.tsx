import { Inbox } from 'lucide-react';
import { type ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export interface EmptyStateProps {
  icone?: ReactNode;
  titulo: ReactNode;
  descricao?: ReactNode;
  /** Botão/link de chamada para ação. */
  acao?: ReactNode;
  className?: string;
  compacto?: boolean;
}

export function EmptyState({
  icone,
  titulo,
  descricao,
  acao,
  className,
  compacto,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-borda px-4 text-center',
        compacto ? 'py-6' : 'py-12',
        className,
      )}
    >
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 [&_svg]:size-6">
        {icone ?? <Inbox aria-hidden="true" />}
      </div>
      <h3 className="text-base font-semibold">{titulo}</h3>
      {descricao ? <p className="mt-1 max-w-sm text-sm text-zinc-500">{descricao}</p> : null}
      {acao ? <div className="mt-4">{acao}</div> : null}
    </div>
  );
}
