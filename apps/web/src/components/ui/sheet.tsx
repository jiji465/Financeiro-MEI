import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { type ComponentProps, type HTMLAttributes } from 'react';

import { cn } from '@/lib/utils/cn';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

const sheetVariants = cva(
  'fixed z-50 flex flex-col gap-4 bg-superficie shadow-xl outline-none data-[state=closed]:animate-fade-out',
  {
    variants: {
      side: {
        bottom:
          'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl border-t border-borda p-5 pt-3 safe-bottom data-[state=open]:animate-slide-in-bottom data-[state=closed]:animate-slide-out-bottom',
        top: 'inset-x-0 top-0 max-h-[92dvh] rounded-b-2xl border-b border-borda p-5 data-[state=open]:animate-fade-in',
        right:
          'inset-y-0 right-0 h-full w-[92vw] max-w-md border-l border-borda p-5 data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right',
        left: 'inset-y-0 left-0 h-full w-[92vw] max-w-xs border-r border-borda p-5 data-[state=open]:animate-slide-in-left data-[state=closed]:animate-slide-out-left',
      },
    },
    defaultVariants: { side: 'bottom' },
  },
);

export interface SheetContentProps
  extends ComponentProps<typeof DialogPrimitive.Content>, VariantProps<typeof sheetVariants> {
  semFechar?: boolean;
}

export function SheetContent({
  className,
  side = 'bottom',
  children,
  semFechar,
  ...props
}: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-zinc-950/50 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content className={cn(sheetVariants({ side }), className)} {...props}>
        {side === 'bottom' ? (
          <div
            aria-hidden="true"
            className="mx-auto h-1.5 w-10 shrink-0 rounded-full bg-zinc-300"
          />
        ) : null}
        {children}
        {semFechar ? null : (
          <DialogPrimitive.Close
            className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-texto"
            aria-label="Fechar"
          >
            <X className="size-5" aria-hidden="true" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 pr-8 text-left', className)} {...props} />;
}

export function SheetFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-auto flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn('text-lg leading-tight font-semibold', className)}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description className={cn('text-sm text-zinc-500', className)} {...props} />
  );
}

export function SheetBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('-mx-1 min-h-0 flex-1 overflow-y-auto px-1', className)} {...props} />;
}
