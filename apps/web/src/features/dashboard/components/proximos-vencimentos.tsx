// Lista dos próximos vencimentos (DAS e parcelas a pagar/receber) dos próximos 30 dias.
import type { ResumoDashboardDto } from '@meifin/shared';
import { ArrowDownCircle, ArrowUpCircle, CalendarClock, Landmark } from 'lucide-react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
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
        // Lista contínua com um fio entre itens (o divide-y do <ul>) em vez de um cartão por
        // vencimento: os valores ficam alinhados na mesma coluna e dá pra varrer de cima a baixo.
        // Só o item atrasado ganha peso — faixa vermelha à esquerda e fundo levíssimo.
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-zinc-50',
          item.atrasado && 'border-l-2 border-despesa-500 bg-despesa-50/40 pl-2.5',
        )}
      >
        <Icone
          className={cn('size-4 shrink-0', item.atrasado ? 'text-despesa-600' : 'text-zinc-400')}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          {/* O selo "Atrasado" fica na segunda linha, junto da data: a primeira linha é só o
              título, que no celular já disputa espaço com o valor. */}
          <p className="truncate text-sm font-medium text-texto">{item.titulo}</p>
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-500">
            <span className="valor">{formatData(item.data)}</span>
            <span aria-hidden="true">·</span>
            <span>{descreverPrazo(item.data)}</span>
            {item.atrasado ? <Badge tone="despesa">Atrasado</Badge> : null}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold whitespace-nowrap text-texto valor">
          {formatBRL(item.valor)}
        </span>
      </Link>
    </li>
  );
}

export interface ProximosVencimentosProps {
  itens: Vencimento[] | undefined;
  loading: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry?: () => void;
}

export function ProximosVencimentos({
  itens,
  loading,
  isError,
  error,
  onRetry,
}: ProximosVencimentosProps) {
  if (loading) {
    return (
      <ul className="-mx-3 divide-y divide-linha" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="flex items-center gap-3 px-3 py-3">
            <Skeleton className="size-4 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-3.5 w-20 shrink-0" />
          </li>
        ))}
      </ul>
    );
  }
  if (isError) {
    return (
      <ErrorState
        titulo="Não foi possível carregar os vencimentos"
        error={error}
        onRetry={onRetry}
        compacto
      />
    );
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
    // -mx-3 sangra a lista até a borda do card: o realce da linha (hover, atrasado) vale a
    // largura inteira do painel, como numa tabela.
    <ul className="-mx-3 divide-y divide-linha">
      {itens.map((item, i) => (
        <ItemVencimento key={`${item.tipo}-${item.data}-${i}`} item={item} />
      ))}
    </ul>
  );
}
