// ConfirmDialog (AlertDialog do Radix) + ConfirmProvider/useConfirm para confirmações imperativas:
//   const confirm = useConfirm();
//   if (await confirm({ titulo: 'Excluir lançamento?', tom: 'destructive' })) { ... }
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import { cn } from '@/lib/utils/cn';

import { buttonVariants } from './button';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: ReactNode;
  descricao?: ReactNode;
  confirmarTexto?: string;
  cancelarTexto?: string;
  tom?: 'default' | 'destructive';
  /** Chamado ao confirmar; se retornar promise, o botão fica em loading até resolver. */
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  titulo,
  descricao,
  confirmarTexto = 'Confirmar',
  cancelarTexto = 'Cancelar',
  tom = 'default',
  onConfirm,
  loading,
}: ConfirmDialogProps) {
  const [executando, setExecutando] = useState(false);
  const ocupado = loading || executando;

  const confirmar = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      setExecutando(true);
      await onConfirm();
      onOpenChange(false);
    } finally {
      setExecutando(false);
    }
  };

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={ocupado ? () => {} : onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-zinc-950/50 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <AlertDialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border border-borda bg-superficie p-5 shadow-xl outline-none data-[state=closed]:animate-zoom-out data-[state=open]:animate-zoom-in md:p-6">
          <div className="flex flex-col gap-1">
            <AlertDialogPrimitive.Title className="text-lg leading-tight font-semibold">
              {titulo}
            </AlertDialogPrimitive.Title>
            {descricao ? (
              <AlertDialogPrimitive.Description className="text-sm text-zinc-500">
                {descricao}
              </AlertDialogPrimitive.Description>
            ) : (
              <AlertDialogPrimitive.Description className="sr-only">
                Confirme a ação
              </AlertDialogPrimitive.Description>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogPrimitive.Cancel
              className={cn(buttonVariants({ variant: 'outline' }))}
              disabled={ocupado}
            >
              {cancelarTexto}
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action
              className={cn(
                buttonVariants({ variant: tom === 'destructive' ? 'destructive' : 'primary' }),
              )}
              disabled={ocupado}
              aria-busy={ocupado || undefined}
              onClick={(e) => void confirmar(e)}
            >
              {ocupado ? 'Aguarde…' : confirmarTexto}
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}

export interface ConfirmOptions {
  titulo: ReactNode;
  descricao?: ReactNode;
  confirmarTexto?: string;
  cancelarTexto?: string;
  tom?: 'default' | 'destructive';
}

type ConfirmFn = (opcoes: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<(ConfirmOptions & { open: boolean }) | null>(null);
  const resolverRef = useRef<((valor: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opcoes) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current?.(false);
      resolverRef.current = resolve;
      setEstado({ ...opcoes, open: true });
    });
  }, []);

  const finalizar = useCallback((valor: boolean) => {
    resolverRef.current?.(valor);
    resolverRef.current = null;
    setEstado((atual) => (atual ? { ...atual, open: false } : atual));
  }, []);

  const valorContexto = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={valorContexto}>
      {children}
      {estado ? (
        <ConfirmDialog
          open={estado.open}
          onOpenChange={(aberto) => {
            if (!aberto) finalizar(false);
          }}
          titulo={estado.titulo}
          descricao={estado.descricao}
          confirmarTexto={estado.confirmarTexto}
          cancelarTexto={estado.cancelarTexto}
          tom={estado.tom}
          onConfirm={() => finalizar(true)}
        />
      ) : null}
    </ConfirmContext.Provider>
  );
}

/** Confirmação imperativa; exige ConfirmProvider (já incluído em app/providers). */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm precisa estar dentro de <ConfirmProvider>');
  return ctx;
}
