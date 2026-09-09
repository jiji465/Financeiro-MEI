// Badges de status e origem de um lançamento (tabela, cartão mobile e diálogo de edição).
import type { OrigemLancamento, StatusLancamento } from '@meifin/shared';
import { Landmark, Link2, Repeat, Upload } from 'lucide-react';

import { Badge, type BadgeTone } from '@/components/ui/badge';
import { ORIGEM_LANCAMENTO_LABELS, STATUS_LANCAMENTO_LABELS } from '@/lib/labels';

const TOM_STATUS: Record<StatusLancamento, BadgeTone> = {
  pago: 'receita',
  pendente: 'alerta',
};

export function StatusLancamentoBadge({ status }: { status: StatusLancamento }) {
  return (
    <Badge tone={TOM_STATUS[status]} dot>
      {STATUS_LANCAMENTO_LABELS[status]}
    </Badge>
  );
}

const ICONE_ORIGEM: Partial<Record<OrigemLancamento, typeof Repeat>> = {
  recorrencia: Repeat,
  das: Landmark,
  baixa: Link2,
  importacao: Upload,
};

/** Só aparece para origens diferentes de "manual" (a mais comum não precisa de selo). */
export function OrigemLancamentoBadge({ origem }: { origem: OrigemLancamento }) {
  if (origem === 'manual') return null;
  const Icone = ICONE_ORIGEM[origem];
  return (
    <Badge tone="outline">
      {Icone ? <Icone aria-hidden="true" /> : null}
      {ORIGEM_LANCAMENTO_LABELS[origem]}
    </Badge>
  );
}
