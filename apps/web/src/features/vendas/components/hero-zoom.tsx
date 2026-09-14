// Hero com zoom controlado pelo scroll — mesmo espírito do efeito visto em mercury.com (parte de
// um ambiente, dá zoom e "entra" na tela do computador), mas com um cenário próprio (mesa
// ilustrada, sem foto — não existe nenhum asset de imagem no projeto) e conteúdo real do produto
// na tela, não uma foto genérica. Atualiza estilo direto via ref (sem setState a cada quadro) pra
// não recriar o componente 60x por segundo.
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';

import { CenaComputador, TELA_RETANGULO } from './cena-computador';
import { PainelPreviewConteudo } from './previews';

const ALTURA_SCROLL_VH = 200;
const ESCALA_MAXIMA = 6.5;
const ORIGEM = {
  x: TELA_RETANGULO.left + TELA_RETANGULO.width / 2,
  y: TELA_RETANGULO.top + TELA_RETANGULO.height / 2,
};

export function HeroZoom() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cenaRef = useRef<HTMLDivElement>(null);
  const textoRef = useRef<HTMLDivElement>(null);
  const telaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame: number;
    const atualizar = () => {
      const wrapper = wrapperRef.current;
      const cena = cenaRef.current;
      if (wrapper && cena) {
        const rect = wrapper.getBoundingClientRect();
        const alturaExtra = rect.height - window.innerHeight;
        const p = alturaExtra > 0 ? Math.min(1, Math.max(0, -rect.top / alturaExtra)) : 0;
        const escala = 1 + p * (ESCALA_MAXIMA - 1);
        cena.style.transform = `scale(${escala})`;
        if (textoRef.current) {
          const opacidade = Math.max(0, 1 - p * 3.5);
          textoRef.current.style.opacity = String(opacidade);
          textoRef.current.style.transform = `translateY(${p * -40}px)`;
          textoRef.current.style.pointerEvents = opacidade < 0.1 ? 'none' : 'auto';
        }
        if (telaRef.current) {
          const acender = Math.min(1, Math.max(0, (p - 0.1) / 0.25));
          telaRef.current.style.opacity = String(acender);
        }
      }
      frame = requestAnimationFrame(atualizar);
    };
    frame = requestAnimationFrame(atualizar);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div ref={wrapperRef} className="relative" style={{ height: `${ALTURA_SCROLL_VH}vh` }}>
      <div className="sticky top-16 flex h-[calc(100dvh-4rem)] flex-col items-center justify-center overflow-hidden bg-fundo px-4 md:px-8">
        <div ref={textoRef} className="relative z-10 mb-6 max-w-2xl text-center md:mb-8">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-texto md:text-5xl lg:text-6xl">
            O financeiro do seu MEI, <span className="text-acento-700">sem sustos</span>
          </h1>
          <p className="mx-auto mt-5 max-w-md text-base text-zinc-600 md:text-lg">
            Lançamentos, DAS, limite anual e relatórios — pensado para quem abre um MEI e quer saber
            exatamente quanto entra, quanto sai e o que falta pagar.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link to="/cadastro">Solicitar acesso</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/entrar">Já tenho conta</Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            O acesso não é aberto: você preenche seus dados e entramos em contato para liberar sua
            conta.
          </p>
        </div>

        <div
          ref={cenaRef}
          className="relative will-change-transform"
          style={{ transformOrigin: `${ORIGEM.x}% ${ORIGEM.y}%` }}
        >
          {/* Altura em vh (não largura fixa): garante que a cena sempre sobre espaço pro texto
           * acima, em qualquer altura de tela — a largura vem sozinha do aspect-ratio. */}
          <div className="relative aspect-[10/7] h-[26vh] max-w-[88vw] sm:h-[30vh] md:h-[34vh]">
            <CenaComputador />
            <div
              className="absolute overflow-hidden rounded-[3px]"
              style={{
                left: `${TELA_RETANGULO.left}%`,
                top: `${TELA_RETANGULO.top}%`,
                width: `${TELA_RETANGULO.width}%`,
                height: `${TELA_RETANGULO.height}%`,
              }}
            >
              <div ref={telaRef} className="h-full w-full bg-superficie p-3 opacity-0 sm:p-4">
                <PainelPreviewConteudo className="h-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
