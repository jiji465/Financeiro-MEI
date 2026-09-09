import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { type ComponentProps, type HTMLAttributes } from 'react';

import { cn } from '@/lib/utils/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

export function DialogOverlay({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-zinc-950/50 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in',
        className,
      )}
      {...props}
    />
  );
}

export interface DialogContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  /** Oculta o botão "Fechar" no canto. */
  semFechar?: boolean;
  /** Largura máxima (padrão: max-w-lg). */
  tamanho?: 'sm' | 'md' | 'lg' | 'xl';
}

const TAMANHOS = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' } as const;

export function DialogContent({
  className,
  children,
  semFechar,
  tamanho = 'md',
  ...props
}: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border border-borda bg-superficie p-5 shadow-xl outline-none data-[state=closed]:animate-zoom-out data-[state=open]:animate-zoom-in md:p-6',
          TAMANHOS[tamanho],
          className,
        )}
        {...props}
      >
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
    </DialogPortal>
  );
}

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 pr-8 text-left', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn('text-lg leading-tight font-semibold', className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description className={cn('text-sm text-zinc-500', className)} {...props} />
  );
}

/** Área rolável do corpo (para formulários longos). */
export function DialogBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('-mx-1 min-h-0 flex-1 overflow-y-auto px-1', className)} {...props} />;
}
