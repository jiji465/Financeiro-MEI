// Janela de navegador desenhada (barra + slot de conteúdo) que vive dentro da tampa do notebook
// do hero. A largura é de projeto (1512px) e a ALTURA É NATURAL: quem define a altura é o
// conteúdo, nunca um aspect-ratio — é a moldura que se ajusta ao app, não o contrário. Sem
// `overflow` vertical: se o painel crescer, a janela cresce junto (app.scrollHeight ===
// app.clientHeight).
import { ChevronLeft, ChevronRight, Lock, PanelLeft, Plus, RotateCw } from 'lucide-react';
import { type ReactNode } from 'react';

/** Largura de projeto da janela — a tampa é essa largura + 2 × 18px de bezel. */
export const LARGURA_JANELA = 1512;

const ENDERECO = 'meifinanceiro.vercel.app';

export interface JanelaNavegadorProps {
  children: ReactNode;
  /** Reflexo que atravessa o vidro de tempos em tempos. Desligue com "menos movimento". */
  brilho?: boolean;
}

export function JanelaNavegador({ children, brilho = true }: JanelaNavegadorProps) {
  return (
    <div
      className="relative overflow-hidden rounded-[6px] bg-superficie"
      style={{ width: LARGURA_JANELA }}
    >
      <div className="flex h-11 items-center gap-4 border-b border-borda bg-linear-to-b from-zinc-100 to-zinc-50 px-4">
        <div className="flex gap-2" aria-hidden="true">
          <span className="size-3 rounded-full bg-zinc-300" />
          <span className="size-3 rounded-full bg-zinc-300" />
          <span className="size-3 rounded-full bg-zinc-300" />
        </div>
        <div className="flex items-center gap-3.5 text-zinc-400" aria-hidden="true">
          <ChevronLeft className="size-4" />
          <ChevronRight className="size-4" />
          <RotateCw className="size-4" />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex h-7 max-w-[440px] min-w-[300px] items-center gap-2 rounded-full border border-borda bg-superficie px-3 text-[13px] text-zinc-500">
            <Lock className="size-3 shrink-0" aria-hidden="true" />
            {ENDERECO}
          </div>
        </div>
        <div className="flex items-center gap-3.5 text-zinc-400" aria-hidden="true">
          <Plus className="size-4" />
          <PanelLeft className="size-4" />
        </div>
      </div>

      {brilho ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[3] overflow-hidden"
        >
          <div
            className="absolute top-[-20%] left-0 h-[140%] w-[28%] animate-varredura"
            style={{
              background:
                'linear-gradient(90deg, oklch(100% 0 0 / 0) 0%, oklch(100% 0 0 / 0.42) 45%, oklch(100% 0 0 / 0) 100%)',
            }}
          />
        </div>
      ) : null}

      {children}
    </div>
  );
}
