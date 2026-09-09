import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { type ComponentProps, type ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({
  className,
  sideOffset = 4,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 max-w-xs rounded-md bg-zinc-900 px-3 py-1.5 text-xs text-white shadow-md data-[state=closed]:animate-fade-out data-[state=delayed-open]:animate-fade-in',
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}

/** Atalho: <TooltipSimples texto="Excluir"><Button size="icon" …/></TooltipSimples> */
export function TooltipSimples({
  texto,
  children,
  side,
}: {
  texto: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{texto}</TooltipContent>
    </Tooltip>
  );
}
