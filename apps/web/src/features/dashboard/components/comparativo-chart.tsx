// Barras de receita/despesa + linha de saldo dos últimos 12 meses.
import type { ComparativoMensalDto } from '@meifin/shared';
import { Bar, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from 'recharts';

import { ChartContainer } from '@/components/charts/chart-container';
import { useChartColors } from '@/components/charts/chart-colors';
import { ChartTooltip } from '@/components/charts/chart-tooltip';
import { formatBRLCompact } from '@/lib/format/money';
import { formatMesAno } from '@/lib/format/date';

export interface ComparativoChartProps {
  dados: ComparativoMensalDto | undefined;
  loading: boolean;
}

export function ComparativoChart({ dados, loading }: ComparativoChartProps) {
  const cores = useChartColors();
  const meses = dados?.meses ?? [];

  if (!loading && meses.every((m) => m.receitas === 0 && m.despesas === 0)) {
    return (
      <p className="flex h-[280px] items-center justify-center text-sm text-zinc-500">
        Sem lançamentos nos últimos meses.
      </p>
    );
  }

  return (
    <ChartContainer
      titulo="Receitas, despesas e saldo dos últimos 12 meses"
      loading={loading}
      tabela={
        <table>
          <caption>Receitas, despesas e saldo por mês</caption>
          <thead>
            <tr>
              <th scope="col">Mês</th>
              <th scope="col">Receitas</th>
              <th scope="col">Despesas</th>
              <th scope="col">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((m) => (
              <tr key={m.competencia}>
                <th scope="row">{formatMesAno(m.competencia)}</th>
                <td>{m.receitas / 100}</td>
                <td>{m.despesas / 100}</td>
                <td>{m.saldo / 100}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ComposedChart data={[...meses]} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={cores.grid} />
        <XAxis
          dataKey="competencia"
          tickFormatter={(v: string) => formatMesAno(v)}
          stroke={cores.eixo}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => formatBRLCompact(v)}
          stroke={cores.eixo}
          tickLine={false}
          axisLine={false}
          width={64}
        />
        <Tooltip
          content={<ChartTooltip formatLabel={(l) => formatMesAno(String(l))} ocultarZeros />}
        />
        <Bar dataKey="receitas" name="Receitas" fill={cores.receita} radius={[3, 3, 0, 0]} />
        <Bar dataKey="despesas" name="Despesas" fill={cores.despesa} radius={[3, 3, 0, 0]} />
        <Line
          type="monotone"
          dataKey="saldo"
          name="Saldo"
          stroke={cores.saldo}
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ChartContainer>
  );
}
