import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { type ComponentProps, type ReactNode, useId } from 'react';

import { cn } from '@/lib/utils/cn';

export interface CheckboxProps extends ComponentProps<typeof CheckboxPrimitive.Root> {
  /** Rótulo clicável ao lado da caixa. */
  label?: ReactNode;
  descricao?: ReactNode;
}

export function Checkbox({ className, label, descricao, id, ...props }: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const caixa = (
    <CheckboxPrimitive.Root
      id={inputId}
      className={cn(
        'peer flex size-5 shrink-0 items-center justify-center rounded border border-zinc-400 bg-superficie shadow-xs transition-colors data-[state=checked]:border-primary-600 data-[state=checked]:bg-primary-600 data-[state=checked]:text-white data-[state=indeterminate]:border-primary-600 data-[state=indeterminate]:bg-primary-600 data-[state=indeterminate]:text-white disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-perigo-500',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        {props.checked === 'indeterminate' ? (
          <Minus className="size-3.5" aria-hidden="true" />
        ) : (
          <Check className="size-3.5" aria-hidden="true" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
  if (!label) return caixa;
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-6 items-center">{caixa}</div>
      <div className="grid gap-0.5">
        <label htmlFor={inputId} className="text-sm leading-6 font-medium select-none">
          {label}
        </label>
        {descricao ? <p className="text-sm text-zinc-500">{descricao}</p> : null}
      </div>
    </div>
  );
}
