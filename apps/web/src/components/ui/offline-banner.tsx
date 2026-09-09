import { WifiOff } from 'lucide-react';

import { useOnline } from '@/lib/hooks/use-online';

/** Faixa fixa no topo quando o navegador está offline (navigator.onLine). */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 bg-alerta-100 px-4 py-2 text-sm font-medium text-alerta-700"
    >
      <WifiOff className="size-4" aria-hidden="true" />
      Você está offline. Os dados serão atualizados quando a conexão voltar.
    </div>
  );
}
