// Atalhos para as ações mais comuns do dia a dia.
import { FileText, Landmark, Plus, ReceiptText } from 'lucide-react';
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
  { label: 'DAS do mês', to: '/das', icone: Landmark, tone: 'neutral' },
  { label: 'Nova nota fiscal', to: '/notas-fiscais?novo=1', icone: FileText, tone: 'neutral' },
];

const TONE_CLASS: Record<Atalho['tone'], string> = {
  receita: 'bg-receita-50 text-receita-700',
  despesa: 'bg-despesa-50 text-despesa-700',
  primary: 'bg-primary-50 text-primary-800',
  neutral: 'bg-zinc-100 text-zinc-700',
};

export function Atalhos() {
  return (
    <nav aria-label="Atalhos" className="flex flex-wrap gap-2">
      {ATALHOS.map((a) => (
        <Link
          key={a.to}
          to={a.to}
          className="flex items-center gap-2 rounded-full border border-borda bg-superficie py-1.5 pr-3.5 pl-2 text-sm font-medium text-texto shadow-xs transition-colors hover:bg-zinc-50"
        >
          <span
            className={`flex size-6 items-center justify-center rounded-full ${TONE_CLASS[a.tone]}`}
          >
            <a.icone className="size-3.5" />
          </span>
          {a.label}
        </Link>
      ))}
    </nav>
  );
}
