import * as PopoverPrimitive from '@radix-ui/react-popover';
import { type ComponentProps } from 'react';

import { cn } from '@/lib/utils/cn';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

export function PopoverContent({
  className,
  align = 'start',
  sideOffset = 4,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-72 rounded-lg border border-borda bg-superficie p-4 text-texto shadow-lg outline-none data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
