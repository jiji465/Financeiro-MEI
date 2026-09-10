import { Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useAuthStore } from '@/features/auth/store';

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';

/** Botão flutuante "+" do mobile: abre a folha "Nova receita / Nova despesa". Some para um
 * administrador puro (tenant interno, sem MEI de verdade — seção 13 do plano). */
export function Fab() {
  const [aberto, setAberto] = useState(false);
  const navigate = useNavigate();
  const interno = useAuthStore((s) => s.tenant?.interno ?? false);

  const ir = (tipo: 'receita' | 'despesa') => {
    setAberto(false);
    navigate(`/lancamentos?novo=${tipo}`);
  };

  if (interno) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Novo lançamento"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-40 flex size-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition-colors hover:bg-primary-700 active:bg-primary-800 md:hidden"
      >
        <Plus className="size-7" aria-hidden="true" />
      </button>
      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Novo lançamento</SheetTitle>
            <SheetDescription>O que você quer registrar?</SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3 pb-2">
            <button
              type="button"
              onClick={() => ir('receita')}
              className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-receita-200 bg-receita-50 p-4 text-sm font-semibold text-receita-700 active:bg-receita-100"
            >
              <TrendingUp className="size-7" aria-hidden="true" />
              Nova receita
            </button>
            <button
              type="button"
              onClick={() => ir('despesa')}
              className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-despesa-200 bg-despesa-50 p-4 text-sm font-semibold text-despesa-700 active:bg-despesa-100"
            >
              <TrendingDown className="size-7" aria-hidden="true" />
              Nova despesa
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
