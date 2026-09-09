import { type TextareaHTMLAttributes } from 'react';

import { cn } from '@/lib/utils/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: React.Ref<HTMLTextAreaElement>;
}

export function Textarea({ className, ref, ...props }: TextareaProps) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-24 w-full rounded-md border border-borda bg-superficie px-3 py-2 text-base text-texto shadow-xs transition-colors placeholder:text-zinc-400 focus-visible:border-primary-500 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary-500/40 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:opacity-70 aria-invalid:border-perigo-500 md:text-sm',
        className,
      )}
      {...props}
    />
  );
}
