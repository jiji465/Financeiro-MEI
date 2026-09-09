// Donut de despesas por categoria (top 6 + "Outras"), com legenda e tabela oculta para leitor
// de tela.
import type { PorCategoriaDto } from '@meifin/shared';
import { Cell, Pie, PieChart, Tooltip } from 'recharts';

import { ChartContainer } from '@/components/charts/chart-container';
import { corCategorica, useChartColors } from '@/components/charts/chart-colors';
import { ChartTooltip } from '@/components/charts/chart-tooltip';
import { EmptyState } from '@/components/ui/empty-state';
import { formatBRL, formatPercentual } from '@/lib/format/money';

export interface CategoriaDonutProps {
  dados: PorCategoriaDto | undefined;
  loading: boolean;
}

export function CategoriaDonut({ dados, loading }: CategoriaDonutProps) {
  const cores = useChartColors();
  const itens = dados?.itens ?? [];

  if (!loading && itens.length === 0) {
    return (
      <EmptyState
        compacto
        titulo="Nenhuma despesa no período"
        descricao="As categorias com mais gastos aparecem aqui assim que você lançar despesas."
      />
    );
  }

  const corDoItem = (item: PorCategoriaDto['itens'][number], i: number) =>
    item.cor ?? corCategorica(i, cores);

  return (
    <div>
      <ChartContainer
        titulo="Despesas por categoria no período"
        loading={loading}
        altura={220}
        tabela={
          <table>
            <caption>Despesas por categoria</caption>
            <thead>
              <tr>
                <th scope="col">Categoria</th>
                <th scope="col">Valor</th>
                <th scope="col">Percentual</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => (
                <tr key={i.categoriaId ?? 'outras'}>
                  <th scope="row">{i.nome}</th>
                  <td>{i.valor / 100}</td>
                  <td>{i.percentual}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <PieChart>
          <Pie
            data={[...itens]}
            dataKey="valor"
            nameKey="nome"
            innerRadius="58%"
            outerRadius="90%"
            paddingAngle={1}
            stroke="none"
          >
            {itens.map((item, i) => (
              <Cell key={item.categoriaId ?? 'outras'} fill={corDoItem(item, i)} />
            ))}
          </Pie>
          <Tooltip
            content={
              <ChartTooltip
                formatValue={(v) =>
                  `${formatBRL(v)} (${formatPercentual((v / (dados?.total || 1)) * 100)})`
                }
              />
            }
          />
        </PieChart>
      </ChartContainer>
      {!loading && itens.length > 0 ? (
        <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2" aria-hidden="true">
          {itens.map((item, i) => (
            <li
              key={item.categoriaId ?? 'outras'}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="flex min-w-0 items-center gap-1.5 truncate text-zinc-600">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: corDoItem(item, i) }}
                />
                <span className="truncate">{item.nome}</span>
              </span>
              <span className="shrink-0 font-medium tabular-nums">{formatBRL(item.valor)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
