// Cenário do hero: um notebook sobre uma mesa, desenhado inteiro em CSS/SVG (não existe nenhuma
// foto no projeto). Parede, mesa, planta e caneca ficam DENTRO do mesmo elemento que recebe o
// `scale` do hero, então tudo cresce junto e nada desalinha durante o zoom.
//
// Regra do aparelho: o bezel é o `padding: 18px` da tampa, nunca uma proporção. A tampa envolve a
// janela e tem altura automática — qualquer tentativa de dar `aspect-ratio` à tela e encaixar o
// app dentro dá sobra ou corte.
//
// Alumínio e tampa são os únicos valores de cor fora de `globals.css`: são material industrial
// (um aparelho cinza), não cor de marca — o handoff documenta isso explicitamente.
import { type ReactNode, type Ref } from 'react';

/** Largura de projeto da cena = largura da tampa: janela de 1512px + 2 × 18px de bezel. */
export const LARGURA_CENA = 1548;

const TAMPA =
  'linear-gradient(172deg, oklch(41% 0.01 280) 0%, oklch(33% 0.01 280) 22%, oklch(27% 0.01 280) 60%, oklch(22% 0.01 280) 100%)';
const SOMBRA_TAMPA = [
  '0 44px 80px -34px oklch(20% 0.02 280 / 0.5)',
  'inset 0 1px 0 0 oklch(100% 0 0 / 0.14)',
  'inset 1px 0 0 0 oklch(100% 0 0 / 0.07)',
  'inset -1px 0 0 0 oklch(100% 0 0 / 0.07)',
].join(', ');
const DOBRADICA =
  'linear-gradient(180deg, oklch(58% 0.008 280), oklch(76% 0.006 280) 45%, oklch(56% 0.008 280))';
const BASE =
  'linear-gradient(180deg, oklch(88% 0.004 280) 0%, oklch(82% 0.006 280) 34%, oklch(75% 0.007 280) 76%, oklch(67% 0.008 280) 100%)';
const PAREDE =
  'linear-gradient(180deg, oklch(96.2% 0.005 280) 0%, oklch(98.4% 0.003 280) 62%, oklch(97.4% 0.004 280) 100%)';
const MESA =
  'linear-gradient(180deg, oklch(89% 0.009 280) 0%, oklch(85% 0.01 280) 14%, oklch(81% 0.012 280) 60%, oklch(76% 0.013 280) 100%)';

export interface CenaComputadorProps {
  /** Conteúdo da tela (a janela do navegador). */
  children: ReactNode;
  /** Ref da moldura — o hero mede a largura/altura dela pra calcular as escalas. */
  molduraRef?: Ref<HTMLDivElement>;
  /** Atraso (ms) da entrada da moldura, lido pelo hero via `data-anima-janela`. */
  atrasoEntrada?: number;
}

export function CenaComputador({ children, molduraRef, atrasoEntrada = 220 }: CenaComputadorProps) {
  return (
    <>
      {/* Parede, com a luz ambiente e um halo discreto do acento */}
      <div
        aria-hidden="true"
        className="absolute z-0"
        style={{ left: -2200, width: 5948, top: -1500, height: 2500, background: PAREDE }}
      >
        <div
          className="absolute top-[78%] left-1/2 h-[1700px] w-[3000px] -translate-x-1/2 -translate-y-1/2"
          style={{
            background:
              'radial-gradient(48% 46% at 50% 50%, oklch(100% 0 0 / 0.85), oklch(100% 0 0 / 0) 72%)',
          }}
        />
        <div
          className="absolute top-[76%] left-1/2 h-[1300px] w-[2400px] -translate-x-1/2 -translate-y-1/2"
          style={{
            background:
              'radial-gradient(44% 44% at 50% 50%, oklch(61% 0.185 262 / 0.07), transparent 70%)',
          }}
        />
      </div>

      {/* Mesa, com o fio de luz da quina */}
      <div
        aria-hidden="true"
        className="absolute z-0"
        style={{ left: -2200, width: 5948, top: 1000, height: 1500, background: MESA }}
      >
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: 'oklch(95% 0.004 280 / 0.9)' }}
        />
        <div
          className="absolute top-0 left-1/2 h-[300px] w-[2600px] -translate-x-1/2"
          style={{
            background:
              'radial-gradient(50% 100% at 50% 0%, oklch(100% 0 0 / 0.28), transparent 72%)',
          }}
        />
      </div>

      {/* Planta, à esquerda */}
      <svg
        aria-hidden="true"
        viewBox="0 0 220 420"
        className="absolute z-0 overflow-visible"
        style={{ left: -480, top: 605, width: 220, height: 420 }}
      >
        <ellipse cx="110" cy="412" rx="92" ry="12" fill="oklch(24% 0.02 280 / 0.14)" />
        <ellipse cx="110" cy="150" rx="26" ry="118" fill="var(--color-receita-600)" />
        <ellipse
          cx="110"
          cy="130"
          rx="26"
          ry="118"
          fill="var(--color-receita-500)"
          transform="rotate(42 110 130)"
        />
        <ellipse
          cx="110"
          cy="130"
          rx="26"
          ry="118"
          fill="var(--color-receita-700)"
          transform="rotate(-42 110 130)"
        />
        <path d="M62 300 L74 405 L146 405 L158 300 Z" fill="var(--color-zinc-300)" />
        <path d="M62 300 L74 405 L110 405 L110 300 Z" fill="oklch(88% 0.009 280)" />
        <rect x="56" y="292" width="108" height="16" rx="4" fill="oklch(87% 0.01 280)" />
      </svg>

      {/* Caneca, à direita */}
      <svg
        aria-hidden="true"
        viewBox="0 0 200 150"
        className="absolute z-0 overflow-visible"
        style={{ left: 1790, top: 885, width: 200, height: 150 }}
      >
        <ellipse cx="92" cy="140" rx="76" ry="10" fill="oklch(24% 0.02 280 / 0.13)" />
        <path
          d="M148 52 q34 0 34 26 q0 26 -34 26"
          fill="none"
          stroke="oklch(86% 0.01 280)"
          strokeWidth="13"
        />
        <rect x="24" y="44" width="126" height="94" rx="14" fill="oklch(99% 0.002 280)" />
        <rect x="24" y="44" width="126" height="10" rx="5" fill="oklch(94% 0.004 280)" />
        <path
          d="M74 30 q9 -18 0 -34"
          fill="none"
          stroke="oklch(88% 0.008 280)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M100 26 q9 -18 0 -34"
          fill="none"
          stroke="oklch(91% 0.006 280)"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>

      {/* Aparelho */}
      <div
        ref={molduraRef}
        data-moldura=""
        data-anima-janela={atrasoEntrada}
        className="relative z-[1]"
        style={{ width: LARGURA_CENA }}
      >
        {/* Tampa: o bezel é este padding, e a altura é a da janela + 2 × 18px */}
        <div
          className="relative rounded-t-[22px] rounded-b-[5px] p-[18px]"
          style={{ background: TAMPA, boxShadow: SOMBRA_TAMPA }}
        >
          {children}
        </div>

        {/* Dobradiça */}
        <div
          aria-hidden="true"
          className="mx-auto h-[7px] w-[84%]"
          style={{
            background: DOBRADICA,
            clipPath: 'polygon(0.5% 0, 99.5% 0, 100% 100%, 0 100%)',
          }}
        />

        {/* Base (sem desenhar teclas: só o rebaixo do teclado) */}
        <div
          aria-hidden="true"
          className="relative ml-[-1.5%] h-[46px] w-[103%] overflow-hidden"
          style={{
            background: BASE,
            clipPath:
              'polygon(2.4% 0, 97.6% 0, 100% 66%, 99.5% 90%, 98.6% 100%, 1.4% 100%, 0.5% 90%, 0 66%)',
          }}
        >
          <div
            className="absolute inset-x-0 top-0 h-0.5"
            style={{ background: 'oklch(96% 0.003 280 / 0.85)' }}
          />
          {/* Reflexo azulado da tela nos primeiros 18px da base */}
          <div
            className="absolute top-0 right-[6%] left-[6%] h-[18px]"
            style={{
              background:
                'linear-gradient(180deg, oklch(80% 0.035 262 / 0.42), oklch(80% 0.035 262 / 0) 100%)',
            }}
          />
          <div
            className="absolute top-[9px] left-[14%] h-5 w-[72%] rounded-[3px]"
            style={{
              background: 'linear-gradient(180deg, oklch(74% 0.006 280), oklch(79% 0.006 280))',
              boxShadow:
                'inset 0 1px 3px 0 oklch(30% 0.01 280 / 0.28), inset 0 -1px 0 0 oklch(100% 0 0 / 0.5)',
            }}
          />
          {/* Quina frontal e rebaixo do dedo */}
          <div
            className="absolute inset-x-0 bottom-0 h-[7px]"
            style={{
              background: 'linear-gradient(180deg, oklch(60% 0.008 280), oklch(71% 0.008 280))',
            }}
          />
          <div
            className="absolute bottom-0 left-[45.5%] h-1 w-[9%] rounded-t-[2px]"
            style={{ background: 'oklch(52% 0.008 280)' }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(102deg, oklch(100% 0 0 / 0.22) 0 12%, oklch(100% 0 0 / 0) 30%)',
            }}
          />
        </div>

        {/* Sombra de contato com a mesa */}
        <div
          aria-hidden="true"
          className="mx-auto mt-1.5 h-[26px] w-[78%]"
          style={{
            background:
              'radial-gradient(60% 100% at 50% 0%, oklch(24% 0.02 280 / 0.22), transparent 72%)',
          }}
        />
      </div>
    </>
  );
}
