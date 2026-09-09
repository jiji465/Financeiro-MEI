import * as SwitchPrimitive from '@radix-ui/react-switch';
import { type ComponentProps, type ReactNode, useId } from 'react';

import { cn } from '@/lib/utils/cn';

export interface SwitchProps extends ComponentProps<typeof SwitchPrimitive.Root> {
  label?: ReactNode;
  descricao?: ReactNode;
}

export function Switch({ className, label, descricao, id, ...props }: SwitchProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const controle = (
    <SwitchPrimitive.Root
      id={inputId}
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-zinc-300 transition-colors data-[state=checked]:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
    </SwitchPrimitive.Root>
  );
  if (!label) return controle;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="grid gap-0.5">
        <label htmlFor={inputId} className="text-sm leading-6 font-medium select-none">
          {label}
        </label>
        {descricao ? <p className="text-sm text-zinc-500">{descricao}</p> : null}
      </div>
      {controle}
    </div>
  );
}
