// Input de data nativo. Valor sempre "AAAA-MM-DD" (string) ou null — sem objetos Date, sem fuso.
import { type InputHTMLAttributes } from 'react';

import { cn } from '@/lib/utils/cn';

import { inputClassName } from './input';

export interface DateInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  ref?: React.Ref<HTMLInputElement>;
}

export function DateInput({ value, onChange, className, ref, ...props }: DateInputProps) {
  return (
    <input
      ref={ref}
      type="date"
      className={cn(inputClassName, 'tabular-nums', className)}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? e.target.value : null)}
      {...props}
    />
  );
}
