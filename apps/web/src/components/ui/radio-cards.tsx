import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { type ReactNode, useId } from 'react';

import { cn } from '@/lib/utils/cn';

export interface RadioCardOption<V extends string = string> {
  value: V;
  label: ReactNode;
  /** Explicação em uma linha abaixo do rótulo. */
  descricao?: ReactNode;
  icone?: ReactNode;
  disabled?: boolean;
}

export interface RadioCardsProps<V extends string = string> {
  value: V | '' | null | undefined;
  onValueChange: (value: V) => void;
  options: readonly RadioCardOption<V>[];
  /** Colunas no desktop (mobile é sempre 1). */
  columns?: 1 | 2 | 3;
  name?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  onBlur?: () => void;
}

/** Grupo de rádios apresentado como cartões clicáveis (atividade do MEI, tipo de contato…). */
export function RadioCards<V extends string = string>({
  value,
  onValueChange,
  options,
  columns = 1,
  name,
  id,
  disabled,
  className,
  onBlur,
  ...aria
}: RadioCardsProps<V>) {
  const base = useId();
  return (
    <RadioGroupPrimitive.Root
      id={id}
      name={name}
      value={value || ''}
      onValueChange={(v) => onValueChange(v as V)}
      disabled={disabled}
      onBlur={onBlur}
      className={cn(
        'grid gap-2',
        columns === 2 && 'sm:grid-cols-2',
        columns === 3 && 'sm:grid-cols-3',
        className,
      )}
      {...aria}
    >
      {options.map((o) => {
        const itemId = `${base}-${o.value}`;
        return (
          <label
            key={o.value}
            htmlFor={itemId}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-lg border border-borda bg-superficie p-3 transition-colors hover:border-primary-300 has-[[data-state=checked]]:border-primary-600 has-[[data-state=checked]]:bg-primary-50 has-[[data-disabled]]:cursor-not-allowed has-[[data-disabled]]:opacity-60 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-600',
              aria['aria-invalid'] && 'border-perigo-500',
            )}
          >
            <RadioGroupPrimitive.Item
              id={itemId}
              value={o.value}
              disabled={o.disabled}
              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-zinc-400 bg-superficie outline-none data-[state=checked]:border-primary-600"
            >
              <RadioGroupPrimitive.Indicator className="size-2.5 rounded-full bg-primary-600" />
            </RadioGroupPrimitive.Item>
            {o.icone ? (
              <span className="mt-0.5 text-primary-700 [&_svg]:size-5">{o.icone}</span>
            ) : null}
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm leading-5 font-medium">{o.label}</span>
              {o.descricao ? (
                <span className="text-sm leading-5 text-zinc-500">{o.descricao}</span>
              ) : null}
            </span>
          </label>
        );
      })}
    </RadioGroupPrimitive.Root>
  );
}
