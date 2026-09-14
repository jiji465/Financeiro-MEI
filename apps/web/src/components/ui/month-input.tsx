// Input de competência nativo. Valor sempre "AAAA-MM" (string) ou null — mesmo formato do schema
// `competencia` de @meifin/shared, sem parsing/máscara extra.
import { type InputHTMLAttributes } from 'react';

import { cn } from '@/lib/utils/cn';

import { inputClassName } from './input';

export interface MonthInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  ref?: React.Ref<HTMLInputElement>;
}

export function MonthInput({ value, onChange, className, ref, ...props }: MonthInputProps) {
  return (
    <input
      ref={ref}
      type="month"
      className={cn(inputClassName, 'tabular-nums', className)}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? e.target.value : null)}
      {...props}
    />
  );
}
