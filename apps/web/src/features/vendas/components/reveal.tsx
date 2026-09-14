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
    const observer = new IntersectionObserver(
      ([entrada]) => {
        if (entrada?.isIntersecting) {
          setVisivel(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
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
