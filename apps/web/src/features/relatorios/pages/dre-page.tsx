// /relatorios/dre — DRE simplificada do período: receitas e despesas por categoria, impostos
// (DAS) e resultado. Período controlado pela URL (?de&ate); exportação em CSV/PDF.
import { LABEL_REGIME_APURACAO, type RegimeApuracao } from '@meifin/shared';

import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { PeriodoSelect, type PeriodoValue } from '@/components/ui/periodo-select';
import { SimpleSelect } from '@/components/ui/select';
import { hojeSP, periodoPreset } from '@/lib/format/date';
import { formatBRL, formatPercentual } from '@/lib/format/money';
import { useSearchParamsObject } from '@/lib/hooks/use-search-params-state';

import { ExportarBotoes } from '../components/exportar-botoes';
import { useBaixarDre, useDre } from '../hooks';

interface LinhaDre {
  categoriaId: string | null;
  nome: string;
  valor: number;
  percentual: number;
  quantidade: number;
}

const OPCOES_REGIME = [
  { value: 'competencia' as const, label: LABEL_REGIME_APURACAO.competencia },
  { value: 'caixa' as const, label: LABEL_REGIME_APURACAO.caixa },
];

function colunas(): DataTableColumn<LinhaDre>[] {
  return [
    { id: 'nome', header: 'Categoria', cell: (l) => l.nome },
    { id: 'quantidade', header: 'Qtd.', cell: (l) => l.quantidade, numeric: true, hideBelow: 'sm' },
    { id: 'percentual', header: '%', cell: (l) => formatPercentual(l.percentual), numeric: true },
    { id: 'valor', header: 'Valor', cell: (l) => formatBRL(l.valor), numeric: true },
  ];
}

export function DrePage() {
  const [params, patch] = useSearchParamsObject(['de', 'ate', 'regime']);
  const padrao = periodoPreset('este_mes', hojeSP());
  const periodo: PeriodoValue = { de: params.de || padrao.de, ate: params.ate || padrao.ate };
  const regime = (params.regime || undefined) as RegimeApuracao | undefined;

  const query = useDre({ de: periodo.de, ate: periodo.ate, regime });
  const baixar = useBaixarDre();
  const dto = query.data;

  return (
    <>
      <PageHeader
        titulo="DRE simplificada"
        descricao="Receitas e despesas por categoria, com o resultado do período."
        voltar="/relatorios"
        acoes={
          <ExportarBotoes
            baixandoCsv={baixar.isPending && baixar.variables?.formato === 'csv'}
            baixandoPdf={baixar.isPending && baixar.variables?.formato === 'pdf'}
            onCsv={() =>
              baixar.mutate({ formato: 'csv', query: { de: periodo.de, ate: periodo.ate, regime } })
            }
            onPdf={() =>
              baixar.mutate({ formato: 'pdf', query: { de: periodo.de, ate: periodo.ate, regime } })
            }
          />
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <PeriodoSelect value={periodo} onChange={(v) => patch({ de: v.de, ate: v.ate })} />
          <div className="w-full sm:w-48">
            <SimpleSelect
              aria-label="Regime de apuração"
              value={regime ?? ''}
              onValueChange={(v) => patch({ regime: v || '' })}
              options={OPCOES_REGIME}
              opcaoVazia="Regime padrão"
            />
          </div>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-zinc-500">Receitas</h2>
          <DataTable
            columns={colunas()}
            data={dto?.receitas.itens}
            rowKey={(l) => l.categoriaId ?? 'outras'}
            isLoading={query.isPending}
            isError={query.isError}
            error={query.error}
            onRetry={() => void query.refetch()}
            footer={dto ? `Total: ${formatBRL(dto.receitas.total)}` : undefined}
            className="rounded-lg border border-borda bg-superficie"
          />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold text-zinc-500">Despesas</h2>
          <DataTable
            columns={colunas()}
            data={dto?.despesas.itens}
            rowKey={(l) => l.categoriaId ?? 'outras'}
            isLoading={query.isPending}
            isError={query.isError}
            error={query.error}
            onRetry={() => void query.refetch()}
            footer={dto ? `Total: ${formatBRL(dto.despesas.total)}` : undefined}
            className="rounded-lg border border-borda bg-superficie"
          />
        </div>
      </div>

      {dto ? (
        <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-borda bg-superficie p-4 sm:grid-cols-4 md:p-5">
          <div>
            <dt className="text-xs text-zinc-500">Receitas</dt>
            <dd className="text-lg font-semibold tabular-nums text-receita-700">
              {formatBRL(dto.receitas.total)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Despesas</dt>
            <dd className="text-lg font-semibold tabular-nums text-despesa-700">
              {formatBRL(dto.despesas.total)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Impostos (DAS)</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatBRL(dto.impostos)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Resultado do período</dt>
            <dd
              className={`text-lg font-semibold tabular-nums ${dto.resultado < 0 ? 'text-despesa-700' : 'text-primary-800'}`}
            >
              {formatBRL(dto.resultado)}
              {dto.margem !== null ? (
                <span className="ml-1 text-xs font-normal text-zinc-500">
                  ({formatPercentual(dto.margem)} de margem)
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
      ) : null}
    </>
  );
}
