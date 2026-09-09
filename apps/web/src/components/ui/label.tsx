import * as LabelPrimitive from '@radix-ui/react-label';
import { type ComponentProps } from 'react';

import { cn } from '@/lib/utils/cn';

export interface LabelProps extends ComponentProps<typeof LabelPrimitive.Root> {
  /** Mostra "(opcional)" ao lado do texto. */
  opcional?: boolean;
}

export function Label({ className, children, opcional, ...props }: LabelProps) {
  return (
    <LabelPrimitive.Root
      className={cn(
        'text-sm leading-none font-medium text-texto select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      {...props}
    >
      {children}
      {opcional ? <span className="ml-1 font-normal text-zinc-500">(opcional)</span> : null}
    </LabelPrimitive.Root>
  );
}
