// Lista dos próximos vencimentos (DAS e parcelas a pagar/receber) dos próximos 30 dias.
import type { ResumoDashboardDto } from '@meifin/shared';
import { ArrowDownCircle, ArrowUpCircle, CalendarClock, Landmark } from 'lucide-react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { descreverPrazo, formatData } from '@/lib/format/date';
import { formatBRL } from '@/lib/format/money';
import { cn } from '@/lib/utils/cn';

type Vencimento = ResumoDashboardDto['proximosVencimentos'][number];

const ICONE: Record<Vencimento['tipo'], typeof Landmark> = {
  das: Landmark,
  parcela_pagar: ArrowUpCircle,
  parcela_receber: ArrowDownCircle,
};

const LINK: Record<Vencimento['tipo'], string> = {
  das: '/das',
  parcela_pagar: '/contas/pagar',
  parcela_receber: '/contas/receber',
};

function ItemVencimento({ item }: { item: Vencimento }) {
  const Icone = ICONE[item.tipo];
  return (
    <li>
      <Link
        to={LINK[item.tipo]}
        className={cn(
          'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-zinc-50',
          item.atrasado ? 'border-despesa-200 bg-despesa-50/50' : 'border-borda',
        )}
      >
        <Icone
          className={cn('size-5 shrink-0', item.atrasado ? 'text-despesa-600' : 'text-zinc-500')}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.titulo}</p>
          <p className="text-xs text-zinc-500">
            {formatData(item.data)} · {descreverPrazo(item.data)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums">{formatBRL(item.valor)}</p>
          {item.atrasado ? (
            <Badge tone="despesa" className="mt-0.5">
              Atrasado
            </Badge>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

export interface ProximosVencimentosProps {
  itens: Vencimento[] | undefined;
  loading: boolean;
}

export function ProximosVencimentos({ itens, loading }: ProximosVencimentosProps) {
  if (loading) {
    return <div className="h-40 animate-pulse rounded-lg bg-zinc-100" aria-hidden="true" />;
  }
  if (!itens || itens.length === 0) {
    return (
      <EmptyState
        compacto
        icone={<CalendarClock aria-hidden="true" />}
        titulo="Nada vencendo nos próximos 30 dias"
        descricao="DAS e contas a pagar/receber vão aparecer aqui conforme o vencimento se aproxima."
      />
    );
  }
  return (
    <ul className="space-y-2">
      {itens.map((item, i) => (
        <ItemVencimento key={`${item.tipo}-${item.data}-${i}`} item={item} />
      ))}
    </ul>
  );
}
