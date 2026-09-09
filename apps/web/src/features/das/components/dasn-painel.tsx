// Painel da DASN-SIMEI de um ano-base: faturamento apurado (comércio × serviços), prazo,
// competências de DAS ainda pendentes e ação para declarar/reabrir.
import { LABEL_STATUS_DASN } from '@meifin/shared';
import { CircleCheck, FileText, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { QueryState } from '@/components/ui/query-state';
import { descreverPrazo, formatData, formatMesExtenso, hojeSP } from '@/lib/format/date';
import { formatBRL } from '@/lib/format/money';
import { plural } from '@/lib/format/texto';

import { useDasn } from '../hooks';
import { LimiteCard } from './limite-card';
import { DasnDialog } from './dasn-dialog';

const TONE_STATUS: Record<'pendente' | 'entregue', BadgeTone> = {
  pendente: 'alerta',
  entregue: 'receita',
};

export function DasnPainel({ anoBase }: { anoBase: number }) {
  const query = useDasn(anoBase);
  const [editando, setEditando] = useState(false);

  return (
    <QueryState query={query}>
      {(dasn) => (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              titulo="Faturamento apurado"
              valor={formatBRL(dasn.faturamentoApurado)}
              rodape={`Comércio ${formatBRL(dasn.receitaComercio)} · Serviços ${formatBRL(dasn.receitaServicos)}`}
            />
            <StatCard
              titulo="Prazo de entrega"
              valor={formatData(dasn.prazo)}
              tone={dasn.atrasada ? 'despesa' : 'neutral'}
              rodape={
                dasn.status === 'entregue'
                  ? dasn.dataEntrega
                    ? `Entregue em ${formatData(dasn.dataEntrega)}`
                    : 'Entregue'
                  : descreverPrazo(dasn.prazo, hojeSP())
              }
            />
            <StatCard
              titulo="DAS pendentes no período"
              valor={String(dasn.dasPendentes.length)}
              tone={dasn.dasPendentes.length > 0 ? 'alerta' : 'neutral'}
              rodape={
                dasn.dasPendentes.length > 0
                  ? dasn.dasPendentes.map((c) => formatMesExtenso(c)).join(', ')
                  : 'Todas as competências devidas estão pagas'
              }
            />
          </div>

          {dasn.receitaSemGrupo > 0 || dasn.alertaSemGrupo ? (
            <div className="flex items-start gap-3 rounded-lg border border-alerta-200 bg-alerta-50/60 px-3 py-2.5 text-sm text-alerta-800">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>
                {formatBRL(dasn.receitaSemGrupo)} em receitas estão em categorias sem grupo definido
                (comércio ou serviços) e não entram na separação por grupo da DASN. Ajuste o grupo
                em{' '}
                <Link
                  to="/configuracoes?aba=categorias"
                  className="font-medium underline underline-offset-4"
                >
                  Categorias
                </Link>
                .
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-borda bg-superficie p-4">
            <div className="flex items-center gap-2">
              {dasn.status === 'entregue' ? (
                <CircleCheck className="size-5 text-receita-600" aria-hidden="true" />
              ) : (
                <FileText className="size-5 text-zinc-500" aria-hidden="true" />
              )}
              <div>
                <p className="text-sm font-medium">
                  Situação:{' '}
                  <Badge tone={TONE_STATUS[dasn.status]}>{LABEL_STATUS_DASN[dasn.status]}</Badge>
                </p>
                {dasn.numeroRecibo ? (
                  <p className="mt-0.5 text-xs text-zinc-500">Recibo {dasn.numeroRecibo}</p>
                ) : null}
              </div>
            </div>
            <Button
              variant={dasn.status === 'entregue' ? 'outline' : 'primary'}
              onClick={() => setEditando(true)}
            >
              {dasn.status === 'entregue' ? 'Editar declaração' : 'Declarar DASN-SIMEI'}
            </Button>
          </div>

          <LimiteCard ano={anoBase} compacto />

          <p className="text-xs text-zinc-500">
            {plural(dasn.dasPendentes.length, 'competência pendente', 'competências pendentes')} de
            DAS no ano-base {anoBase}. A DASN-SIMEI declara o faturamento de {anoBase} e deve ser
            entregue até {formatData(dasn.prazo)}.
          </p>

          <DasnDialog dasn={editando ? dasn : null} onOpenChange={(open) => setEditando(open)} />
        </div>
      )}
    </QueryState>
  );
}
