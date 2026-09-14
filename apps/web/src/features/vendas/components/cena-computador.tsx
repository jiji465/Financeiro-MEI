// Cenário ilustrado (mesa + monitor) pro efeito de zoom do hero — como não existe nenhuma foto
// no projeto, a "sala" é desenhada em SVG, com as mesmas cores do design system (sem paleta nova).
// A área da tela é vazada (moldura sem preenchimento) pra um overlay em HTML (o mockup real do
// painel) encaixar exatamente por cima — texto nítido em qualquer zoom, sem borrão de imagem.

/** Retângulo da tela dentro da cena, em % do contêiner — usado pra posicionar o overlay por cima. */
export const TELA_RETANGULO = { left: 23.4, top: 16.3, width: 53.2, height: 47.4 };

export function CenaComputador() {
  return (
    <svg viewBox="0 0 1000 700" aria-hidden="true" className="h-full w-full">
      <defs>
        <linearGradient id="parede-gradiente" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--color-zinc-50)" />
          <stop offset="100%" stopColor="var(--color-zinc-100)" />
        </linearGradient>
      </defs>

      {/* Parede */}
      <rect x="0" y="0" width="1000" height="470" fill="url(#parede-gradiente)" />
      {/* Mesa */}
      <rect x="0" y="470" width="1000" height="230" fill="var(--color-zinc-200)" />
      <rect x="0" y="470" width="1000" height="6" fill="var(--color-zinc-300)" />

      {/* Vasinho de planta, à esquerda */}
      <g>
        <path d="M120 470 L110 560 L190 560 L180 470 Z" fill="var(--color-zinc-400)" />
        <ellipse cx="150" cy="430" rx="12" ry="55" fill="var(--color-receita-600)" />
        <ellipse
          cx="150"
          cy="410"
          rx="12"
          ry="55"
          fill="var(--color-receita-600)"
          transform="rotate(45 150 410)"
        />
        <ellipse
          cx="150"
          cy="410"
          rx="12"
          ry="55"
          fill="var(--color-receita-700)"
          transform="rotate(-45 150 410)"
        />
      </g>

      {/* Xícara, à direita */}
      <g>
        <rect x="830" y="500" width="70" height="55" rx="10" fill="var(--color-superficie)" />
        <path
          d="M900 512 q26 0 26 20 q0 20 -26 20"
          fill="none"
          stroke="var(--color-zinc-400)"
          strokeWidth="8"
        />
        <path
          d="M850 480 q6 -14 0 -26"
          fill="none"
          stroke="var(--color-zinc-300)"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </g>

      {/* Base e pé do monitor */}
      <rect x="470" y="560" width="60" height="80" fill="var(--color-zinc-400)" />
      <rect x="410" y="638" width="180" height="18" rx="9" fill="var(--color-zinc-400)" />

      {/* Moldura do monitor */}
      <rect x="210" y="90" width="580" height="380" rx="24" fill="var(--color-zinc-800)" />
      <circle cx="500" cy="112" r="4" fill="var(--color-zinc-600)" />
      <circle cx="500" cy="452" r="5" fill="var(--color-acento-500)" />
      {/* Recorte da tela — o overlay HTML entra exatamente aqui (ver TELA_RETANGULO) */}
      <rect x="234" y="114" width="532" height="332" rx="6" fill="var(--color-zinc-900)" />
    </svg>
  );
}
