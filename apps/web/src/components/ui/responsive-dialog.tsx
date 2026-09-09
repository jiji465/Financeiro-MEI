// Dialog centralizado no desktop; bottom sheet no mobile. Mesmo conteúdo, mesma API.
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { type ReactNode } from 'react';

import { useIsMobile } from '@/lib/hooks/use-media-query';
import { cn } from '@/lib/utils/cn';

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from './sheet';

export const ResponsiveDialogClose = DialogPrimitive.Close;
export const ResponsiveDialogTrigger = DialogPrimitive.Trigger;

export interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: ReactNode;
  descricao?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  tamanho?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** Bloqueia o fechamento por clique fora/Esc (ex.: enquanto salva). */
  bloqueado?: boolean;
  trigger?: ReactNode;
}

export function ResponsiveDialog({
  open,
  onOpenChange,
  titulo,
  descricao,
  children,
  footer,
  tamanho,
  className,
  bloqueado,
  trigger,
}: ResponsiveDialogProps) {
  const mobile = useIsMobile();
  const bloqueio = bloqueado
    ? {
        onPointerDownOutside: (e: Event) => e.preventDefault(),
        onEscapeKeyDown: (e: KeyboardEvent) => e.preventDefault(),
      }
    : {};

  if (mobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
        <SheetContent side="bottom" className={className} {...bloqueio}>
          <SheetHeader>
            <SheetTitle>{titulo}</SheetTitle>
            {descricao ? (
              <SheetDescription>{descricao}</SheetDescription>
            ) : (
              <SheetDescription className="sr-only">{titulo}</SheetDescription>
            )}
          </SheetHeader>
          <SheetBody>{children}</SheetBody>
          {footer ? <SheetFooter>{footer}</SheetFooter> : null}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
      <DialogContent tamanho={tamanho} className={cn(className)} {...bloqueio}>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descricao ? (
            <DialogDescription>{descricao}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{titulo}</DialogDescription>
          )}
        </DialogHeader>
        <DialogBody>{children}</DialogBody>
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}
