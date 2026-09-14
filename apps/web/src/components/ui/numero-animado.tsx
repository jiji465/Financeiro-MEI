import { useEffect, useRef, useState } from 'react';

export interface NumeroAnimadoProps {
  /** Valor final. */
  valor: number;
  /** Formata o número exibido a cada quadro (ex.: formatBRL, formatPercentual). */
  formatar: (v: number) => string;
  duracaoMs?: number;
}

function prefereMenosMovimento(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Conta de 0 até `valor` com desaceleração suave (ease-out). Pula a animação se o usuário
 * preferir menos movimento — exibe o valor final direto. */
export function NumeroAnimado({ valor, formatar, duracaoMs = 900 }: NumeroAnimadoProps) {
  const [exibido, setExibido] = useState(() => (prefereMenosMovimento() ? valor : 0));
  const inicioRef = useRef<number | null>(null);

  useEffect(() => {
    // Duração 0 (menos movimento) faz o primeiro quadro já cair em t=1 — chega no valor final
    // num passo só, mas o setState continua acontecendo dentro do callback do rAF (não síncrono
    // no corpo do efeito, que é o que a regra react-hooks/set-state-in-effect não permite).
    const duracaoEfetiva = prefereMenosMovimento() ? 0 : duracaoMs;
    inicioRef.current = null;
    let frame: number;
    const passo = (agora: number) => {
      inicioRef.current ??= agora;
      const t =
        duracaoEfetiva === 0 ? 1 : Math.min(1, (agora - inicioRef.current) / duracaoEfetiva);
      const facilitado = 1 - (1 - t) ** 3;
      setExibido(Math.round(valor * facilitado));
      if (t < 1) frame = requestAnimationFrame(passo);
    };
    frame = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(frame);
  }, [valor, duracaoMs]);

  return <>{formatar(exibido)}</>;
}
