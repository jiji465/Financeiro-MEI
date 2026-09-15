import { Check } from 'lucide-react';
import { type ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export interface VitrineSecaoProps {
  titulo: string;
  /** Uma frase entre o título e os bullets — explica o benefício antes da lista de como. */
  descricao?: string;
  bullets: readonly string[];
  preview: ReactNode;
  /** Inverte a ordem (imagem à esquerda no desktop). */
  inverter?: boolean;
}

/** Bloco alternado texto/mockup usado na vitrine de recursos da página de vendas. */
export function VitrineSecao({ titulo, descricao, bullets, preview, inverter }: VitrineSecaoProps) {
  return (
    <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-12">
      <div className={cn(inverter && 'md:order-2')}>
        <h3 className="font-display text-2xl font-semibold tracking-tight text-texto md:text-3xl">
          {titulo}
        </h3>
        {descricao ? <p className="mt-3 text-base text-zinc-600">{descricao}</p> : null}
        <ul className="mt-5 space-y-3">
          {bullets.map((bullet) => (
            <li
              key={bullet}
              className="flex items-start gap-2.5 text-sm text-zinc-600 md:text-base"
            >
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-receita-100 text-receita-700">
                <Check className="size-3" aria-hidden="true" />
              </span>
              {bullet}
            </li>
          ))}
        </ul>
      </div>
      <div className={cn('flex justify-center', inverter && 'md:order-1')}>{preview}</div>
    </div>
  );
}
