// Badge de status/tipo de nota fiscal — usado na lista e no detalhe.
import type { StatusNota, TipoNota } from '@meifin/shared';

import { Badge, type BadgeTone } from '@/components/ui/badge';
import { STATUS_NOTA_LABELS, TIPO_NOTA_LABELS } from '@/lib/labels';

const TONE_STATUS: Record<StatusNota, BadgeTone> = {
  emitida: 'receita',
  cancelada: 'neutral',
};

export function StatusNotaBadge({ status }: { status: StatusNota }) {
  return (
    <Badge tone={TONE_STATUS[status]} dot>
      {STATUS_NOTA_LABELS[status]}
    </Badge>
  );
}

export function TipoNotaBadge({ tipo }: { tipo: TipoNota }) {
  return <Badge tone="outline">{TIPO_NOTA_LABELS[tipo]}</Badge>;
}
