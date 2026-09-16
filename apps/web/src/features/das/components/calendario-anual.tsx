// Calendário anual das obrigações: o ano inteiro numa tela, mês a mês.
//
// `GET /obrigacoes/calendario` existia desde o início e nenhuma tela o consumia
// (docs/handoff/WP4.md registrava a lacuna). Ele junta o que as outras telas mostram separado:
// DAS, DASN, parcelas a pagar/receber, lançamentos pendentes e feriados.
//
// A escolha aqui é mostrar o ANO, não o mês: quem abre esta tela quer ver o que vem pela frente
// e em que mês a conta aperta — para o mês corrente já existem o painel inicial e a lista de
// contas, que fazem isso melhor.
import type { EventoCalendarioDto, TipoEventoCalendario } from '@meifin/shared';
import { MESES_PT_BR } from '@meifin/shared';
import { CalendarDays } from 'lucide-react';

import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { SkeletonText } from '@/components/ui/skeleton';
import { formatData } from '@/lib/format/date';
import { formatBRL } from '@/lib/format/money';

import { useCalendario } from '../hooks';

const LABEL_TIPO: Record<TipoEventoCalendario, string> = {
  das: 'DAS',
  dasn: 'DASN',
  parcela_pagar: 'A pagar',
  parcela_receber: 'A receber',
  lancamento_pendente: 'Pendente',
  feriado: 'Feriado',
};

/** Tom pelo STATUS quando ele diz algo (atrasado, pago), senão pelo tipo do evento. */
function tomDoEvento(e: EventoCalendarioDto): BadgeTone {
  if (e.status === 'atrasado') return 'despesa';
  if (e.status === 'pago') return 'receita';
  if (e.tipo === 'feriado') return 'outline';
  if (e.tipo === 'parcela_receber') return 'receita';
  return 'neutral';
}

/**
 * A API reaproveita o status do DAS para todos os eventos, então uma declaração entregue chega
 * como "pago" — e "DASN paga" não quer dizer nada. Declaração se ENTREGA; conta a receber se
 * RECEBE. O rótulo é traduzido aqui, na ponta, sem mexer no contrato.
 */
function rotuloDoStatus(e: EventoCalendarioDto): string | null {
  if (e.status === 'informativo' || e.status === 'futuro') return null;
  if (e.status === 'historico') return 'Não registrado';
  if (e.status === 'atrasado') return 'Atrasado';
  if (e.status === 'pendente') return 'Pendente';
  if (e.tipo === 'dasn') return 'Entregue';
  if (e.tipo === 'parcela_receber') return 'Recebido';
  return 'Pago';
}

function agruparPorMes(eventos: readonly EventoCalendarioDto[]): EventoCalendarioDto[][] {
  const meses: EventoCalendarioDto[][] = Array.from({ length: 12 }, () => []);
  for (const e of eventos) {
    const mes = Number(e.data.slice(5, 7)) - 1;
    if (mes >= 0 && mes < 12) meses[mes]!.push(e);
  }
  for (const lista of meses) lista.sort((a, b) => a.data.localeCompare(b.data));
  return meses;
}

export function CalendarioAnual({ ano }: { ano: number }) {
  const query = useCalendario(`${ano}-01-01`, `${ano}-12-31`);
  const eventos = query.data ?? [];
  const meses = agruparPorMes(eventos);

  if (query.isPending) return <SkeletonText linhas={8} />;
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (eventos.length === 0) {
    return (
      <EmptyState
        icone={<CalendarDays aria-hidden="true" />}
        titulo={`Nada marcado em ${ano}`}
        descricao="DAS, declaração anual, contas a vencer e lançamentos pendentes aparecem aqui conforme você for usando o sistema."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {meses.map((doMes, i) => (
        <Card key={MESES_PT_BR[i]} className={doMes.length === 0 ? 'opacity-60' : undefined}>
          <CardContent className="p-4">
            <h3 className="mb-2 flex items-baseline justify-between gap-2 text-sm font-semibold text-texto">
              {MESES_PT_BR[i]}
              {doMes.length > 0 ? (
                <span className="text-xs font-normal text-zinc-500">
                  {doMes.length} {doMes.length === 1 ? 'item' : 'itens'}
                </span>
              ) : null}
            </h3>

            {doMes.length === 0 ? (
              <p className="text-sm text-zinc-400">Sem compromissos</p>
            ) : (
              <ul className="divide-y divide-linha">
                {doMes.map((e, j) => (
                  <li key={`${e.data}-${e.tipo}-${j}`} className="py-2 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-texto">{e.titulo}</p>
                        <p className="text-xs text-zinc-500">
                          {formatData(e.data)} · {LABEL_TIPO[e.tipo]}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {e.valor !== null ? (
                          <span className="text-sm text-texto tabular-nums">
                            {formatBRL(e.valor)}
                          </span>
                        ) : null}
                        {rotuloDoStatus(e) ? (
                          <Badge tone={tomDoEvento(e)} className="font-normal">
                            {rotuloDoStatus(e)}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
