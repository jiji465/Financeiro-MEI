import { ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useAuthStore } from '@/features/auth/store';

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { ACOES_DESTAQUE, ACOES_SECUNDARIAS } from './acoes-novo';

const CARTAO_POR_TONE: Record<string, string> = {
  receita: 'border-receita-200 bg-receita-50 text-receita-700 active:bg-receita-100',
  despesa: 'border-despesa-200 bg-despesa-50 text-despesa-700 active:bg-despesa-100',
};

/** Botão flutuante "+" do celular. Mesma lista do menu "Novo" do desktop (acoes-novo.tsx):
 * receita e despesa em destaque, porque é o que o dono faz todo dia, e o resto em lista.
 * Some para um administrador puro (tenant interno, sem MEI de verdade — seção 13 do plano). */
export function Fab() {
  const [aberto, setAberto] = useState(false);
  const navigate = useNavigate();
  const interno = useAuthStore((s) => s.tenant?.interno ?? false);

  const ir = (to: string) => {
    setAberto(false);
    navigate(to);
  };

  if (interno) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Novo"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-40 flex size-14 items-center justify-center rounded-full bg-acento-600 text-white shadow-lg transition-colors hover:bg-acento-700 active:bg-acento-800 md:hidden"
      >
        <Plus className="size-7" aria-hidden="true" />
      </button>
      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Novo</SheetTitle>
            <SheetDescription>O que você quer registrar?</SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3">
            {ACOES_DESTAQUE.map((acao) => (
              <button
                key={acao.id}
                type="button"
                onClick={() => ir(acao.to)}
                className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border p-4 text-sm font-semibold ${CARTAO_POR_TONE[acao.tone ?? '']}`}
              >
                <acao.icone className="size-7" aria-hidden="true" />
                {acao.label}
              </button>
            ))}
          </div>
          <ul className="mt-3 divide-y divide-linha overflow-hidden rounded-xl border border-borda pb-2">
            {ACOES_SECUNDARIAS.map((acao) => (
              <li key={acao.id}>
                <button
                  type="button"
                  onClick={() => ir(acao.to)}
                  className="flex min-h-12 w-full items-center gap-3 bg-superficie px-4 py-3 text-left text-sm font-medium text-texto active:bg-zinc-50"
                >
                  <acao.icone className="size-5 text-zinc-500" aria-hidden="true" />
                  <span className="flex-1">{acao.label}</span>
                  <ChevronRight className="size-4 text-zinc-400" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
