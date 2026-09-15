// Hero com zoom dirigido pelo scroll: um notebook sobre a mesa que cresce até preencher a janela
// enquanto o texto se apaga. Regras que este arquivo existe para respeitar:
//
//  · `transform` em UM elemento só (`cenaRef`) e SEM `will-change`: promover a camada faz o
//    navegador ampliar o raster antigo e borrar tudo. O cenário fica dentro desse elemento, então
//    parede, mesa e objetos escalam junto e nunca desalinham.
//  · A escala final nunca passa de 1 — o app é renderizado no tamanho de projeto e o `scale` só
//    reduz. Ampliar raster pequeno é o que deixava o texto borrado.
//  · Nada de posicionar o app por medição: ele é filho da tela e o encaixe é geométrico.
//  · As escalas são recalculadas em mount/load/resize/fonts.ready/ResizeObserver — nunca por
//    quadro. `p` fica em `ref`, não em `state`: escrever `state` a cada quadro recriaria o
//    componente 60 vezes por segundo.
//  · O zoom é calculado no evento de `scroll` (que sempre dispara), não num rAF perpétuo.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';

import { CenaComputador, LARGURA_CENA } from './cena-computador';
import { JanelaNavegador } from './janela-navegador';
import { PainelMock } from './painel-mock';

/** Curso do scroll que o zoom consome. */
const ALTURA_SCROLL_VH = 200;
/** Altura do cabeçalho fixo (h-16). */
const ALTURA_CABECALHO = 64;
/** Quanto da largura da janela o aparelho ocupa no fim do zoom. */
const PREENCHIMENTO = 0.8;
/** Quanto da altura visível o aparelho ocupa em repouso. */
const REPOUSO = 0.58;
/** Faixa de mesa reservada abaixo do notebook (senão o cenário fica fora da dobra). */
const FAIXA_MESA = 190;
/** Menos movimento: o zoom continua (é o usuário que o dirige), mas com curso menor. */
const CURSO_REDUZIDO = 0.4;

function prefereMenosMovimento(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function HeroZoom() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const cenaRef = useRef<HTMLDivElement>(null);
  const textoRef = useRef<HTMLDivElement>(null);
  const molduraRef = useRef<HTMLDivElement>(null);

  const [reduzido] = useState(prefereMenosMovimento);
  // Muda a cada disparo da entrada; o painel usa isso pra reiniciar contagens e barra.
  const [repeticao, setRepeticao] = useState(0);

  /** Entrada escalonada. O conteúdo NASCE VISÍVEL no markup — só escondemos dentro de um quadro
   * real, senão um ambiente sem quadros (aba oculta, impressão, captura) deixaria a página em
   * branco. Também usamos `transition` em vez de `animation ... both`: se o navegador engasgar, o
   * estado que fica aplicado é o final. */
  const animarEntrada = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || reduzido) return;
    const timers: number[] = [];
    const frame = requestAnimationFrame(() => {
      const entrar = (el: HTMLElement, atraso: number, distancia: number, duracao: number) => {
        el.style.transition = 'none';
        el.style.opacity = '0';
        el.style.transform = `translateY(${distancia}px)`;
        timers.push(
          window.setTimeout(() => {
            el.style.transition = `opacity ${duracao}ms ease-out, transform ${duracao}ms cubic-bezier(.2,.8,.2,1)`;
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
          }, atraso + 40),
        );
      };
      wrapper.querySelectorAll<HTMLElement>('[data-anima]').forEach((el) => {
        entrar(el, Number(el.dataset.anima) || 0, 18, 720);
      });
      const moldura = molduraRef.current;
      if (moldura) entrar(moldura, Number(moldura.dataset.animaJanela) || 0, 42, 900);
    });
    setRepeticao((n) => n + 1);
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
    };
  }, [reduzido]);

  // Dispara a entrada 260ms depois do mount e sempre que o hero volta a ficar visível.
  useEffect(() => {
    if (reduzido) return;
    let limpar: (() => void) | undefined;
    // Já "gasta": a primeira entrada é a do setTimeout abaixo, não a do observer (que dispara
    // no mount e faria a sequência rodar duas vezes sobrepostas).
    let ultima = Date.now();
    const disparar = () => {
      limpar?.();
      ultima = Date.now();
      limpar = animarEntrada();
    };
    const inicial = window.setTimeout(disparar, 260);
    const alvo = wrapperRef.current;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada?.isIntersecting) return;
        if (Date.now() - ultima < 1800) return;
        disparar();
      },
      { threshold: 0.4 },
    );
    if (alvo) observador.observe(alvo);
    return () => {
      clearTimeout(inicial);
      observador.disconnect();
      limpar?.();
    };
  }, [animarEntrada, reduzido]);

  // Escalas + progresso do scroll.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const slot = slotRef.current;
    const cena = cenaRef.current;
    const moldura = molduraRef.current;
    if (!wrapper || !slot || !cena || !moldura) return;

    let sIni = 0;
    let sFim = 1;
    let dyMax = 0;
    let pAtual = -1;

    const aplicar = (p: number) => {
      cena.style.transform = `translateY(${p * dyMax}px) scale(${sIni + p * (sFim - sIni)})`;
      const texto = textoRef.current;
      if (!texto) return;
      const opacidade = Math.max(0, 1 - p * 3.2);
      texto.style.opacity = String(opacidade);
      texto.style.transform = `translateY(${p * -40}px)`;
      texto.style.pointerEvents = opacidade < 0.1 ? 'none' : 'auto';
    };

    const configurar = () => {
      const largura = moldura.offsetWidth;
      const altura = moldura.offsetHeight;
      const area = window.innerHeight - ALTURA_CABECALHO;
      if (!largura || !altura || area <= 0) return;
      // No fim: cabe na largura e ocupa quase toda a altura visível. Nunca passa de 1.
      const sCheio = Math.min(
        1,
        (window.innerWidth * PREENCHIMENTO) / largura,
        (area * 0.94) / altura,
      );
      // Em repouso não pode passar do espaço que sobra abaixo do texto, senão nasce cortado.
      const texto = textoRef.current;
      const sobra = Math.max(140, area - (texto ? texto.offsetHeight + 28 : 0));
      sIni = Math.min(sCheio, (area * REPOUSO) / altura, sobra / (altura + FAIXA_MESA));
      sFim = reduzido ? sIni + (sCheio - sIni) * CURSO_REDUZIDO : sCheio;
      slot.style.height = `${Math.round((altura + FAIXA_MESA) * sIni)}px`;
      dyMax = 24 - slot.offsetTop;
      aplicar(pAtual < 0 ? 0 : pAtual);
    };

    const atualizar = () => {
      if (!sIni) return;
      const rect = wrapper.getBoundingClientRect();
      const extra = rect.height - window.innerHeight;
      const p = extra > 0 ? Math.min(1, Math.max(0, -rect.top / extra)) : 0;
      if (p === pAtual) return;
      pAtual = p;
      aplicar(p);
    };

    const recalcular = () => {
      configurar();
      atualizar();
    };

    recalcular();
    // O layout só assenta depois das fontes e das imagens; recalcular algumas vezes é mais
    // barato (e mais confiável) do que medir a cada quadro.
    const timers = [120, 400, 1200].map((t) => window.setTimeout(recalcular, t));
    window.addEventListener('scroll', atualizar, { passive: true });
    window.addEventListener('resize', recalcular);
    window.addEventListener('load', recalcular);
    void document.fonts.ready.then(recalcular);
    const observador = new ResizeObserver(recalcular);
    observador.observe(moldura);

    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('scroll', atualizar);
      window.removeEventListener('resize', recalcular);
      window.removeEventListener('load', recalcular);
      observador.disconnect();
    };
  }, [reduzido]);

  return (
    <div ref={wrapperRef} className="relative" style={{ height: `${ALTURA_SCROLL_VH}vh` }}>
      <div className="sticky top-16 flex h-[calc(100dvh-4rem)] flex-col items-center justify-center overflow-hidden bg-fundo px-4 md:px-8">
        <div ref={textoRef} className="relative z-10 mb-5 max-w-[44rem] text-center">
          <h1
            data-anima="0"
            className="text-[clamp(2.25rem,4.6vw,3.6rem)] leading-[1.04] font-semibold tracking-[-0.022em] text-balance text-texto"
          >
            Quanto <span className="text-acento-700">sobrou</span> pra você esse mês?
          </h1>
          <p
            data-anima="90"
            className="mx-auto mt-[18px] max-w-[36rem] text-[1.0625rem] leading-[1.5] text-pretty text-zinc-600"
          >
            Se a resposta é &ldquo;não sei direito&rdquo;, é pra isso que o MEI Financeiro existe.
            Você registra o que entra e o que sai; ele mostra quanto sobra, avisa do DAS antes de
            vencer e acompanha o seu limite anual.
          </p>
          <div data-anima="180" className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/cadastro">Solicitar acesso</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/entrar">Já tenho conta</Link>
            </Button>
          </div>
          <p data-anima="260" className="mt-3 text-xs text-zinc-500">
            Sem cadastro automático: a gente conversa com você e entrega a conta já configurada pro
            seu MEI.
          </p>
        </div>

        {/* Slot: reserva a altura do notebook em repouso (o hero ajusta via JS). */}
        <div ref={slotRef} className="relative w-full" style={{ height: 320 }}>
          {/* ÚNICO elemento que recebe transform. */}
          <div
            ref={cenaRef}
            className="absolute top-0 left-1/2"
            style={{
              width: LARGURA_CENA,
              marginLeft: -LARGURA_CENA / 2,
              transformOrigin: '50% 0%',
            }}
          >
            <CenaComputador molduraRef={molduraRef}>
              <JanelaNavegador brilho={!reduzido}>
                <PainelMock repeticao={repeticao} animar={!reduzido} />
              </JanelaNavegador>
            </CenaComputador>
          </div>
        </div>
      </div>
    </div>
  );
}
