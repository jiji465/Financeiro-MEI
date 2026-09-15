// Painel de resumo do período. Em vez de quatro cards de peso igual (em que nada é "o número
// da tela"), um único painel com hierarquia: o saldo é o número grande — é a pergunta que o MEI
// faz primeiro, "sobrou quanto?" —, receitas e despesas ficam ao lado como as duas parcelas que
// explicam esse saldo, e o previsto/pendências descem para uma faixa de rodapé.
import type { ResumoDashboardDto } from '@meifin/shared';

import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { StatCard } from '@/components/ui/stat-card';
import { formatBRL } from '@/lib/format/money';

export interface ResumoCardsProps {
  resumo: ResumoDashboardDto | undefined;
  loading: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry?: () => void;
}

function Rodape({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs text-zinc-500">{rotulo}</span>
      <span className="text-sm font-medium text-texto valor">{valor}</span>
    </div>
  );
}

export function ResumoCards({ resumo, loading, isError, error, onRetry }: ResumoCardsProps) {
  if (isError) {
    return (
      <ErrorState
        titulo="Não foi possível carregar o resumo"
        error={error}
        onRetry={onRetry}
        compacto
      />
    );
  }

  const saldo = resumo?.saldo.valor ?? 0;
  // Vermelho no saldo só quando ele é negativo: o vermelho continua significando "problema",
  // e um saldo positivo não precisa de cor para ser lido como positivo.
  const toneSaldo = saldo < 0 ? 'despesa' : 'neutral';

  return (
    <Card className="overflow-hidden">
      {/* gap-px sobre o fundo da borda desenha os fios divisórios do painel sem borda por célula */}
      <div className="grid gap-px bg-borda sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr]">
        <StatCard
          semCard
          className="bg-superficie p-4 sm:col-span-2 md:p-5 lg:col-span-1"
          titulo="Saldo do período"
          valor={loading ? '' : formatBRL(saldo)}
          loading={loading}
          tone={toneSaldo}
          tamanho="lg"
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
          semCard
          className="bg-superficie p-4 md:p-5"
          titulo="Entradas"
          valor={loading ? '' : formatBRL(resumo?.receitas.valor ?? 0)}
          loading={loading}
          tone="receita"
          delta={
            resumo
              ? {
                  percentual: resumo.receitas.variacao,
                  descricao: 'vs. anterior',
                  altaEhBoa: true,
                }
              : undefined
          }
          rodape={
            resumo && resumo.receitasPendentes > 0
              ? `${formatBRL(resumo.receitasPendentes)} ainda a receber`
              : undefined
          }
        />
        <StatCard
          semCard
          className="bg-superficie p-4 md:p-5"
          titulo="Saídas"
          valor={loading ? '' : formatBRL(resumo?.despesas.valor ?? 0)}
          loading={loading}
          tone="despesa"
          delta={
            resumo
              ? {
                  percentual: resumo.despesas.variacao,
                  descricao: 'vs. anterior',
                  altaEhBoa: false,
                }
              : undefined
          }
          rodape={
            resumo && resumo.despesasPendentes > 0
              ? `${formatBRL(resumo.despesasPendentes)} ainda a pagar`
              : undefined
          }
        />
      </div>

      {resumo && !loading ? (
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-linha bg-zinc-50/60 px-4 py-3 md:px-5">
          <Rodape rotulo="Saldo previsto (com pendentes)" valor={formatBRL(resumo.saldoPrevisto)} />
          <Rodape rotulo="Lançamentos no período" valor={String(resumo.quantidadeLancamentos)} />
        </div>
      ) : null}
    </Card>
  );
}
