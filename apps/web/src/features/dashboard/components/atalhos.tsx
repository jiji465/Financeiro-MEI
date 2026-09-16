// Atalhos para as ações mais comuns do dia a dia.
import { FileText, Landmark, Plus, ReceiptText, UserRound } from 'lucide-react';
import type { ComponentType } from 'react';
import { Link } from 'react-router';

interface Atalho {
  label: string;
  to: string;
  icone: ComponentType<{ className?: string }>;
  tone: 'receita' | 'despesa' | 'primary' | 'neutral';
}

const ATALHOS: Atalho[] = [
  { label: 'Nova receita', to: '/lancamentos?novo=receita', icone: Plus, tone: 'receita' },
  { label: 'Nova despesa', to: '/lancamentos?novo=despesa', icone: Plus, tone: 'despesa' },
  { label: 'Nova conta', to: '/contas/receber?novo=1', icone: ReceiptText, tone: 'primary' },
  { label: 'Novo cliente', to: '/contatos/novo?tipo=cliente', icone: UserRound, tone: 'neutral' },
  { label: 'DAS do mês', to: '/das', icone: Landmark, tone: 'neutral' },
  { label: 'Nova nota fiscal', to: '/notas-fiscais?novo=1', icone: FileText, tone: 'neutral' },
];

const TONE_CLASS: Record<Atalho['tone'], string> = {
  receita: 'bg-receita-50 text-receita-700',
  despesa: 'bg-despesa-50 text-despesa-700',
  primary: 'bg-zinc-100 text-zinc-500',
  neutral: 'bg-zinc-100 text-zinc-500',
};

export function Atalhos() {
  return (
    // Rola na horizontal no celular em vez de quebrar em duas linhas de pílulas: mantém os
    // atalhos numa faixa só, previsível, sem empurrar o conteúdo abaixo pra fora da dobra.
    <nav
      aria-label="Atalhos"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-fina md:mx-0 md:flex-wrap md:px-0 md:pb-0"
    >
      {ATALHOS.map((a) => (
        <Link
          key={a.to}
          to={a.to}
          className="flex shrink-0 items-center gap-2 rounded-full border border-borda bg-superficie py-1.5 pr-3.5 pl-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-borda-forte hover:bg-zinc-50 hover:text-texto"
        >
          <span
            className={`flex size-6 items-center justify-center rounded-full ${TONE_CLASS[a.tone]}`}
            aria-hidden="true"
          >
            <a.icone className="size-3.5" />
          </span>
          {a.label}
        </Link>
      ))}
    </nav>
  );
}
