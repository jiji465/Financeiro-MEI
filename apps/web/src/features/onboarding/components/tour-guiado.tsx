// Tour guiado de boas-vindas: um balão por vez, com destaque (spotlight) sobre o elemento real da
// tela a que ele se refere. Usa Dialog do Radix só pelo foco/Escape/portal — a posição e o recorte
// de destaque são calculados a partir do retângulo do elemento-alvo (sem lib de tour nova).
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useLayoutEffect, useState, type CSSProperties } from 'react';

import { Button } from '@/components/ui/button';

import { useAberturaAutomaticaDoTour, useEncerrarTour } from '../hooks';
import { PASSOS_TOUR, type PassoTour } from '../passos';
import { useTourStore } from '../store';

const MARGEM_DESTAQUE = 8;
const MARGEM_CARD = 16;
const LARGURA_CARD = 320;
const ALTURA_CARD_ESTIMADA = 160;

function encontrarAlvoVisivel(seletor: string): Element | null {
  const elementos = document.querySelectorAll(seletor);
  for (const el of elementos) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return el;
  }
  return null;
}

/** O componente que chama isto é sempre remontado a cada passo (key={passo.id} no chamador) —
 * `rect` sempre nasce null de novo, então as ramificações "sem alvo"/"alvo não encontrado" não
 * precisam chamar setState pra limpar um valor do passo anterior (não existe valor anterior). */
function useRetanguloDoAlvo(seletor: string | undefined): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (!seletor) return;
    const el = encontrarAlvoVisivel(seletor);
    if (!el) return;
    // O alvo pode estar fora da área visível (passo alcançado com a página rolada, ou telas
    // menores) — sem rolar até ele, o balão (position: fixed) fica medido fora da tela e nunca
    // aparece, travando o tour nesse passo.
    el.scrollIntoView({ block: 'center', behavior: 'auto' });
    const medir = () => setRect(el.getBoundingClientRect());
    const frame = requestAnimationFrame(medir);
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [seletor]);

  return rect;
}

function posicaoDoCard(rect: DOMRect | null): CSSProperties {
  if (!rect) {
    return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }
  const espacoAbaixo = window.innerHeight - rect.bottom;
  const abaixo =
    espacoAbaixo > ALTURA_CARD_ESTIMADA + MARGEM_CARD || rect.top < ALTURA_CARD_ESTIMADA;
  const left = Math.min(
    Math.max(rect.left + rect.width / 2, LARGURA_CARD / 2 + MARGEM_CARD),
    window.innerWidth - LARGURA_CARD / 2 - MARGEM_CARD,
  );
  return abaixo
    ? { top: rect.bottom + MARGEM_CARD, left, transform: 'translate(-50%, 0)' }
    : { top: rect.top - MARGEM_CARD, left, transform: 'translate(-50%, -100%)' };
}

/** Só monta enquanto o tour está aberto — assim `passo` sempre nasce zerado, sem efeito de reset. */
export function TourGuiado() {
  useAberturaAutomaticaDoTour();
  const aberto = useTourStore((s) => s.aberto);
  return aberto ? <TourAtivo /> : null;
}

function TourAtivo() {
  const fechar = useTourStore((s) => s.fechar);
  const encerrar = useEncerrarTour();
  const [passo, setPasso] = useState(0);

  const passoAtual = PASSOS_TOUR[passo];
  if (!passoAtual) return null;

  const ultimoPasso = passo === PASSOS_TOUR.length - 1;

  const finalizar = () => {
    encerrar();
    fechar();
  };

  return (
    <DialogPrimitive.Root open onOpenChange={(v) => (v ? null : finalizar())}>
      <DialogPrimitive.Portal>
        {/* key={passoAtual.id}: cada passo mede um alvo diferente — remontar evita carregar o
         * retângulo do passo anterior enquanto o novo ainda não foi medido. */}
        <ConteudoDoPasso
          key={passoAtual.id}
          passo={passoAtual}
          indice={passo}
          total={PASSOS_TOUR.length}
          ultimoPasso={ultimoPasso}
          onVoltar={() => setPasso((p) => p - 1)}
          onAvancar={() => (ultimoPasso ? finalizar() : setPasso((p) => p + 1))}
          onPular={finalizar}
        />
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

interface ConteudoDoPassoProps {
  passo: PassoTour;
  indice: number;
  total: number;
  ultimoPasso: boolean;
  onVoltar: () => void;
  onAvancar: () => void;
  onPular: () => void;
}

function ConteudoDoPasso({
  passo,
  indice,
  total,
  ultimoPasso,
  onVoltar,
  onAvancar,
  onPular,
}: ConteudoDoPassoProps) {
  const rect = useRetanguloDoAlvo(passo.alvo);

  return (
    <>
      <div className="fixed inset-0 z-100" aria-hidden="true">
        {rect ? (
          <div
            className="fixed rounded-lg shadow-[0_0_0_9999px_rgba(15,23,42,0.6)] transition-all duration-200 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
            style={{
              top: rect.top - MARGEM_DESTAQUE,
              left: rect.left - MARGEM_DESTAQUE,
              width: rect.width + MARGEM_DESTAQUE * 2,
              height: rect.height + MARGEM_DESTAQUE * 2,
            }}
          />
        ) : (
          <div className="fixed inset-0 bg-zinc-950/60 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        )}
      </div>
      <DialogPrimitive.Content
        onInteractOutside={(e) => e.preventDefault()}
        className="fixed z-101 flex w-[calc(100%-2rem)] flex-col gap-3 rounded-xl border border-borda bg-superficie p-4 shadow-xl outline-none data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
        style={{ maxWidth: LARGURA_CARD, ...posicaoDoCard(rect) }}
      >
        <DialogPrimitive.Title className="text-sm font-semibold text-texto">
          {passo.titulo}
        </DialogPrimitive.Title>
        <DialogPrimitive.Description className="text-sm text-zinc-600">
          {passo.texto}
        </DialogPrimitive.Description>
        <div className="flex items-center justify-between gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onPular}>
            Pular
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">
              {indice + 1} de {total}
            </span>
            {indice > 0 ? (
              <Button variant="outline" size="sm" onClick={onVoltar}>
                Voltar
              </Button>
            ) : null}
            <Button size="sm" onClick={onAvancar}>
              {ultimoPasso ? 'Concluir' : 'Próximo'}
            </Button>
          </div>
        </div>
      </DialogPrimitive.Content>
    </>
  );
}
