import type { TipoContato } from '@meifin/shared';

import { Badge, type BadgeTone } from '@/components/ui/badge';
import { TIPO_CONTATO_LABELS } from '@/lib/labels';

const TONE: Record<TipoContato, BadgeTone> = {
  cliente: 'receita',
  fornecedor: 'despesa',
  ambos: 'primary',
};

export function TipoContatoBadge({ tipo, className }: { tipo: TipoContato; className?: string }) {
  return (
    <Badge tone={TONE[tipo]} className={className}>
      {TIPO_CONTATO_LABELS[tipo]}
    </Badge>
  );
}
