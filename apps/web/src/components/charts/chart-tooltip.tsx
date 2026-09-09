// Tooltip customizado do Recharts com valores em BRL.
//   <Tooltip content={<ChartTooltip />} />
import { formatBRL } from '@/lib/format/money';

export interface ChartTooltipItem {
  name?: string | number;
  value?: number | string | ReadonlyArray<number | string>;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipItem[];
  label?: string | number;
  /** Formata o rótulo do eixo (ex.: competência → "mar/2026"). */
  formatLabel?: (label: string | number | undefined) => string;
  /** Formata cada valor; padrão formatBRL (centavos). */
  formatValue?: (value: number, item: ChartTooltipItem) => string;
  /** Oculta séries com valor 0/undefined. */
  ocultarZeros?: boolean;
}

export function ChartTooltip({
  active,
  payload,
  label,
  formatLabel,
  formatValue = (v) => formatBRL(v),
  ocultarZeros,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const itens = payload.filter((p) => {
    const v = typeof p.value === 'number' ? p.value : Number(p.value);
    return !ocultarZeros || (Number.isFinite(v) && v !== 0);
  });
  if (itens.length === 0) return null;
  return (
    <div className="min-w-40 rounded-lg border border-borda bg-superficie px-3 py-2 text-xs shadow-lg">
      {label !== undefined ? (
        <p className="mb-1 font-medium text-texto">
          {formatLabel ? formatLabel(label) : String(label)}
        </p>
      ) : null}
      <ul className="space-y-0.5">
        {itens.map((item, i) => {
          const valor = typeof item.value === 'number' ? item.value : Number(item.value);
          return (
            <li
              key={`${String(item.dataKey ?? item.name)}-${i}`}
              className="flex items-center justify-between gap-4"
            >
              <span className="flex items-center gap-1.5 text-zinc-600">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ backgroundColor: item.color ?? 'currentColor' }}
                />
                {String(item.name ?? '')}
              </span>
              <span className="font-medium tabular-nums">
                {Number.isFinite(valor) ? formatValue(valor, item) : String(item.value ?? '')}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
