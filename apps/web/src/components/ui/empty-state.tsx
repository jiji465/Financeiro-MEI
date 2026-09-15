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
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-borda bg-superficie/60 px-4 text-center',
        compacto ? 'py-7' : 'py-14',
        className,
      )}
    >
      {/* O ícone do estado vazio é orientação, não destaque: fica em cinza pra não competir com
          o botão de ação, que é a única coisa colorida do bloco. */}
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 [&_svg]:size-5">
        {icone ?? <Inbox aria-hidden="true" />}
      </div>
      <h3 className="text-[0.9375rem] font-semibold text-texto">{titulo}</h3>
      {descricao ? (
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-zinc-500">{descricao}</p>
      ) : null}
      {acao ? <div className="mt-5">{acao}</div> : null}
    </div>
  );
}
