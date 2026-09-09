// /relatorios/faturamento — faturamento acumulado no ano frente ao limite anual do MEI, mês a
// mês, com a mesma explicação de nível usada no card do dashboard.
import { LABEL_NIVEL_LIMITE, LABEL_REGIME_APURACAO } from '@meifin/shared';

import { Badge, type BadgeTone } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { Progress, toneDoPercentual } from '@/components/ui/progress';
import { SimpleSelect } from '@/components/ui/select';
import { explicacaoNivel } from '@/features/das';
import { formatMesAno, hojeSP } from '@/lib/format/date';
import { formatBRL, formatPercentual } from '@/lib/format/money';
import { useSearchParamsObject } from '@/lib/hooks/use-search-params-state';

import { ExportarBotoes } from '../components/exportar-botoes';
import { useBaixarLimite, useLimiteRelatorio } from '../hooks';

interface LinhaMes {
  competencia: string;
  valor: number;
  acumulado: number;
  percentualAcumulado: number;
}

const TONE_NIVEL: Record<string, BadgeTone> = {
  ok: 'receita',
  atencao: 'alerta',
  alerta: 'despesa',
  estourado: 'despesa',
};

function anosDisponiveis(hoje: string): { value: string; label: string }[] {
  const anoAtual = Number(hoje.slice(0, 4));
  return Array.from({ length: 4 }, (_, i) => anoAtual - i).map((a) => ({
    value: String(a),
    label: String(a),
  }));
}

export function FaturamentoPage() {
  const [params, patch] = useSearchParamsObject(['ano']);
  const ano = Number(params.ano) || Number(hojeSP().slice(0, 4));

  const query = useLimiteRelatorio({ ano });
  const baixar = useBaixarLimite();
  const dto = query.data;

  const colunas: DataTableColumn<LinhaMes>[] = [
    { id: 'mes', header: 'Mês', cell: (m) => formatMesAno(m.competencia) },
    { id: 'valor', header: 'Faturamento', numeric: true, cell: (m) => formatBRL(m.valor) },
    { id: 'acumulado', header: 'Acumulado', numeric: true, cell: (m) => formatBRL(m.acumulado) },
    {
      id: 'percentual',
      header: '% do limite',
      numeric: true,
      cell: (m) => formatPercentual(m.percentualAcumulado),
    },
  ];

  return (
    <>
      <PageHeader
        titulo="Faturamento x limite anual"
        descricao="Quanto do limite de faturamento do MEI já foi usado neste ano, mês a mês."
        voltar="/relatorios"
        acoes={
          <ExportarBotoes
            baixandoCsv={baixar.isPending && baixar.variables?.formato === 'csv'}
            baixandoPdf={baixar.isPending && baixar.variables?.formato === 'pdf'}
            onCsv={() => baixar.mutate({ formato: 'csv', query: { ano } })}
            onPdf={() => baixar.mutate({ formato: 'pdf', query: { ano } })}
          />
        }
      >
        <div className="w-32">
          <SimpleSelect
            aria-label="Ano"
            value={String(ano)}
            onValueChange={(v) => patch({ ano: v })}
            options={anosDisponiveis(hojeSP())}
          />
        </div>
      </PageHeader>

      {dto ? (
        <div className="mb-4 rounded-lg border border-borda bg-superficie p-4 md:p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <span className="text-2xl font-bold tabular-nums">
                {formatPercentual(dto.percentual)}
              </span>
              <span className="ml-2 text-sm text-zinc-500">
                do limite de {formatBRL(dto.limite)}
              </span>
            </div>
            <Badge tone={TONE_NIVEL[dto.nivel]}>{LABEL_NIVEL_LIMITE[dto.nivel]}</Badge>
          </div>
          <Progress
            value={dto.percentual}
            tone={toneDoPercentual(dto.percentual)}
            markers={dto.marcas.map((m) => ({ valor: m, label: `${m}%` }))}
            size="lg"
          />
          <p className="mt-4 text-sm text-zinc-600">{explicacaoNivel(dto)}</p>
          <p className="mt-2 text-xs text-zinc-500">
            Regime {LABEL_REGIME_APURACAO[dto.regime].toLowerCase()} · faturado{' '}
            {formatBRL(dto.acumulado)} · restante {formatBRL(dto.restante)}
            {dto.projecao !== null ? ` · projeção para dezembro: ${formatBRL(dto.projecao)}` : ''}
          </p>
        </div>
      ) : null}

      <DataTable
        columns={colunas}
        data={dto?.porMes}
        rowKey={(m) => m.competencia}
        isLoading={query.isPending}
        isError={query.isError}
        error={query.error}
        onRetry={() => void query.refetch()}
        caption="Faturamento por mês"
        className="rounded-lg border border-borda bg-superficie"
      />
    </>
  );
}
