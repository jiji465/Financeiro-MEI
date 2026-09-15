import { useEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Atraso em ms antes de iniciar a transição (pra escalonar itens de uma lista). */
  atraso?: number;
}

/** Revela o conteúdo com um leve fade + subida quando ele entra na tela. Some só uma vez — não
 * volta a esconder ao rolar pra cima. Sem efeito nenhum se o usuário preferir menos movimento. */
export function Reveal({ children, className, atraso = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Já nasce visível se o usuário preferir menos movimento — evita setState síncrono no efeito
  // só pra "desligar" a animação (regra react-hooks/set-state-in-effect).
  const [visivel, setVisivel] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    if (visivel) return;
    const el = ref.current;
    if (!el) return;

    // A margem superior gigante é proposital: sem ela, num salto de scroll (roda rápida, âncora,
    // restaurar posição) o elemento vai de "abaixo da dobra" direto pra "acima da tela" com a
    // proporção visível sempre em 0 — o observer nunca dispara e o bloco fica invisível pra
    // sempre. Esticando a área observada pra cima, "já passou do topo" também conta como visto.
    // A margem inferior negativa mantém o comportamento desejado na entrada: só revela quando o
    // bloco realmente entrou na tela, não quando está encostando na borda de baixo.
    const observer = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada?.isIntersecting) return;
        observer.disconnect();
        setVisivel(true);
      },
      { threshold: 0.15, rootMargin: '9999px 0px -8% 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [visivel]);

  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-700 ease-out',
        visivel ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
        className,
      )}
      style={{ transitionDelay: visivel ? `${atraso}ms` : '0ms' }}
    >
      {children}
    </div>
  );
}
