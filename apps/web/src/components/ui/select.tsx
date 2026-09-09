import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { type ComponentProps } from 'react';

import type { Opcao } from '@/lib/labels';
import { cn } from '@/lib/utils/cn';

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'flex h-11 w-full items-center justify-between gap-2 rounded-md border border-borda bg-superficie px-3 py-2 text-base text-texto shadow-xs transition-colors focus-visible:border-primary-500 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary-500/40 disabled:cursor-not-allowed disabled:opacity-60 data-[placeholder]:text-zinc-400 aria-invalid:border-perigo-500 md:h-10 md:text-sm [&>span]:truncate',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-4 shrink-0 text-zinc-500" aria-hidden="true" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        className={cn(
          'relative z-50 max-h-72 min-w-32 overflow-hidden rounded-lg border border-borda bg-superficie text-texto shadow-lg data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in',
          position === 'popper' && 'w-full min-w-[var(--radix-select-trigger-width)]',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center">
          <ChevronUp className="size-4" />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center">
          <ChevronDown className="size-4" />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectLabel({ className, ...props }: ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      className={cn('px-2 py-1.5 text-xs font-medium text-zinc-500', className)}
      {...props}
    />
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex min-h-10 w-full cursor-default items-center rounded-md py-2 pr-8 pl-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-zinc-100',
        className,
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export function SelectSeparator({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-borda', className)} {...props} />
  );
}

/** Radix não aceita item com value ""; usamos um sentinela para "todos"/"nenhum". */
const VAZIO = '__vazio__';

export interface SimpleSelectProps<V extends string = string> {
  value: V | '' | null | undefined;
  onValueChange: (value: V | '') => void;
  options: readonly Opcao<V>[];
  placeholder?: string;
  /** Rótulo de uma opção que limpa a seleção (ex.: "Todos"). */
  opcaoVazia?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  'aria-label'?: string;
  onBlur?: () => void;
}

/** Select controlado a partir de uma lista de opções. */
export function SimpleSelect<V extends string = string>({
  value,
  onValueChange,
  options,
  placeholder = 'Selecione…',
  opcaoVazia,
  disabled,
  id,
  name,
  className,
  onBlur,
  ...aria
}: SimpleSelectProps<V>) {
  return (
    <Select
      value={value ? value : opcaoVazia ? VAZIO : undefined}
      onValueChange={(v) => onValueChange(v === VAZIO ? '' : (v as V))}
      disabled={disabled}
      name={name}
    >
      <SelectTrigger id={id} className={className} onBlur={onBlur} {...aria}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {opcaoVazia ? <SelectItem value={VAZIO}>{opcaoVazia}</SelectItem> : null}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
