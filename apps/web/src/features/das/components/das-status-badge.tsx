// Badge de status do DAS (pago / pendente / atrasado / futuro / não devido) e seletor de ano.
import { LABEL_STATUS_DAS, type StatusDas } from '@meifin/shared';

import { Badge, type BadgeTone } from '@/components/ui/badge';
import { SimpleSelect } from '@/components/ui/select';

const TONE_STATUS: Record<StatusDas, BadgeTone> = {
  pago: 'receita',
  pendente: 'alerta',
  atrasado: 'despesa',
  futuro: 'neutral',
};

export function DasStatusBadge({ status, devida }: { status: StatusDas; devida: boolean }) {
  if (!devida && status !== 'pago') {
    return <Badge tone="outline">Não devido</Badge>;
  }
  return (
    <Badge tone={TONE_STATUS[status]} dot={status !== 'futuro'}>
      {LABEL_STATUS_DAS[status]}
    </Badge>
  );
}

export interface SeletorAnoProps {
  ano: number;
  onChange: (ano: number) => void;
  /** Primeiro ano da lista (ex.: ano de abertura do MEI). */
  desde?: number;
  /** Último ano da lista (padrão: ano atual + 1). */
  ate?: number;
  id?: string;
}

export function anosDisponiveis(anoAtual: number, desde?: number, ate?: number): number[] {
  const fim = ate ?? anoAtual + 1;
  const inicio = Math.min(desde ?? anoAtual - 2, anoAtual - 2);
  const anos: number[] = [];
  for (let a = fim; a >= inicio; a--) anos.push(a);
  return anos;
}

export function SeletorAno({ ano, onChange, desde, ate, id }: SeletorAnoProps) {
  const anoAtual = new Date().getFullYear();
  const anos = anosDisponiveis(anoAtual, desde, ate);
  if (!anos.includes(ano)) anos.push(ano);
  const opcoes = anos.sort((a, b) => b - a).map((a) => ({ value: String(a), label: String(a) }));
  return (
    <SimpleSelect
      id={id}
      aria-label="Ano"
      className="w-28"
      value={String(ano)}
      options={opcoes}
      onValueChange={(v) => {
        if (v) onChange(Number(v));
      }}
    />
  );
}
