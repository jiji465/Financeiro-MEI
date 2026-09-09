import { type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export const inputClassName =
  'flex h-11 w-full min-w-0 rounded-md border border-borda bg-superficie px-3 py-2 text-base text-texto shadow-xs transition-colors placeholder:text-zinc-400 focus-visible:border-primary-500 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary-500/40 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:opacity-70 aria-invalid:border-perigo-500 aria-invalid:focus-visible:outline-perigo-500/40 md:h-10 md:text-sm';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Conteúdo fixo à esquerda (ex.: "R$"). */
  prefixo?: ReactNode;
  /** Conteúdo fixo à direita (ex.: ícone, botão de mostrar senha). */
  sufixo?: ReactNode;
  ref?: React.Ref<HTMLInputElement>;
}

export function Input({ className, type = 'text', prefixo, sufixo, ref, ...props }: InputProps) {
  if (!prefixo && !sufixo) {
    return <input ref={ref} type={type} className={cn(inputClassName, className)} {...props} />;
  }
  return (
    <div className="relative flex w-full items-center">
      {prefixo ? (
        <span className="pointer-events-none absolute left-3 text-sm text-zinc-500 select-none">
          {prefixo}
        </span>
      ) : null}
      <input
        ref={ref}
        type={type}
        className={cn(inputClassName, prefixo && 'pl-10', sufixo && 'pr-10', className)}
        {...props}
      />
      {sufixo ? (
        <span className="absolute right-1 flex items-center text-zinc-500">{sufixo}</span>
      ) : null}
    </div>
  );
}
