// Cards de resumo do período: receitas, despesas, saldo e saldo previsto (com pendentes).
import type { ResumoDashboardDto } from '@meifin/shared';
import { ArrowDownCircle, ArrowUpCircle, TrendingUp, Wallet } from 'lucide-react';

import { StatCard } from '@/components/ui/stat-card';
import { formatBRL } from '@/lib/format/money';

export interface ResumoCardsProps {
  resumo: ResumoDashboardDto | undefined;
  loading: boolean;
}

export function ResumoCards({ resumo, loading }: ResumoCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        titulo="Receitas"
        valor={loading ? '' : formatBRL(resumo?.receitas.valor ?? 0)}
        loading={loading}
        tone="receita"
        icone={<ArrowDownCircle aria-hidden="true" />}
        delta={
          resumo
            ? {
                percentual: resumo.receitas.variacao,
                descricao: 'vs. período anterior',
                altaEhBoa: true,
              }
            : undefined
        }
        rodape={
          resumo && resumo.receitasPendentes > 0
            ? `+ ${formatBRL(resumo.receitasPendentes)} a receber`
            : undefined
        }
      />
      <StatCard
        titulo="Despesas"
        valor={loading ? '' : formatBRL(resumo?.despesas.valor ?? 0)}
        loading={loading}
        tone="despesa"
        icone={<ArrowUpCircle aria-hidden="true" />}
        delta={
          resumo
            ? {
                percentual: resumo.despesas.variacao,
                descricao: 'vs. período anterior',
                altaEhBoa: false,
              }
            : undefined
        }
        rodape={
          resumo && resumo.despesasPendentes > 0
            ? `+ ${formatBRL(resumo.despesasPendentes)} a pagar`
            : undefined
        }
      />
      <StatCard
        titulo="Saldo do período"
        valor={loading ? '' : formatBRL(resumo?.saldo.valor ?? 0)}
        loading={loading}
        tone={resumo && resumo.saldo.valor < 0 ? 'despesa' : 'primary'}
        icone={<Wallet aria-hidden="true" />}
        delta={
          resumo
            ? {
                percentual: resumo.saldo.variacao,
                descricao: 'vs. período anterior',
                altaEhBoa: true,
              }
            : undefined
        }
      />
      <StatCard
        titulo="Saldo previsto"
        valor={loading ? '' : formatBRL(resumo?.saldoPrevisto ?? 0)}
        loading={loading}
        tone="neutral"
        icone={<TrendingUp aria-hidden="true" />}
        rodape="Com pendentes já lançados"
      />
    </div>
  );
}
