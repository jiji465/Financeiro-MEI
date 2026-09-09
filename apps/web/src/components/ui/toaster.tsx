import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert } from 'lucide-react';
import { Toaster as Sonner } from 'sonner';

import { useIsMobile } from '@/lib/hooks/use-media-query';

export { toast } from 'sonner';

/** Toasts globais (sonner). No mobile ficam no topo para não cobrir a barra inferior. */
export function Toaster() {
  const mobile = useIsMobile();
  return (
    <Sonner
      position={mobile ? 'top-center' : 'bottom-right'}
      closeButton
      richColors
      duration={4000}
      icons={{
        success: <CircleCheck className="size-4" aria-hidden="true" />,
        error: <CircleAlert className="size-4" aria-hidden="true" />,
        warning: <TriangleAlert className="size-4" aria-hidden="true" />,
        info: <Info className="size-4" aria-hidden="true" />,
        loading: <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />,
      }}
      toastOptions={{
        classNames: {
          toast: 'font-sans text-sm rounded-lg shadow-lg',
          closeButton: 'border-borda',
        },
      }}
    />
  );
}
