// /relatorios/extrato — lançamentos do período com saldo corrido, prontos para conferência.
import { LABEL_STATUS_LANCAMENTO, LABEL_TIPO_LANCAMENTO, TIPOS_LANCAMENTO } from '@meifin/shared';

import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { PeriodoSelect, type PeriodoValue } from '@/components/ui/periodo-select';
import { SimpleSelect } from '@/components/ui/select';
import { formatData, hojeSP, periodoPreset } from '@/lib/format/date';
import { formatBRL } from '@/lib/format/money';
import { useSearchParamsObject } from '@/lib/hooks/use-search-params-state';

import { ExportarBotoes } from '../components/exportar-botoes';
import { useBaixarExtrato, useExtrato } from '../hooks';

interface LinhaExtrato {
  id: string;
  data: string;
  descricao: string;
  tipo: 'receita' | 'despesa';
  categoria: string | null;
  contato: string | null;
  status: 'pago' | 'pendente';
  valor: number;
  saldo: number;
}

const OPCOES_TIPO = TIPOS_LANCAMENTO.map((t) => ({ value: t, label: LABEL_TIPO_LANCAMENTO[t] }));

export function ExtratoPage() {
  const [params, patch] = useSearchParamsObject(['de', 'ate', 'tipo', 'todos']);
  const padrao = periodoPreset('este_mes', hojeSP());
  const periodo: PeriodoValue = { de: params.de || padrao.de, ate: params.ate || padrao.ate };
  const tipo = (params.tipo || undefined) as 'receita' | 'despesa' | undefined;
  const somentePagos = params.todos !== '1';

  const filtros = { de: periodo.de, ate: periodo.ate, tipo, somentePagos };
  const query = useExtrato(filtros);
  const baixar = useBaixarExtrato();
  const dto = query.data;

  const colunas: DataTableColumn<LinhaExtrato>[] = [
    { id: 'data', header: 'Data', cell: (l) => formatData(l.data) },
    { id: 'descricao', header: 'Descrição', cell: (l) => l.descricao },
    {
      id: 'categoria',
      header: 'Categoria',
      cell: (l) => l.categoria ?? '—',
      hideBelow: 'md',
    },
    { id: 'contato', header: 'Contato', cell: (l) => l.contato ?? '—', hideBelow: 'lg' },
    {
      id: 'status',
      header: 'Status',
      cell: (l) => (
        <Badge tone={l.status === 'pago' ? 'receita' : 'alerta'}>
          {LABEL_STATUS_LANCAMENTO[l.status]}
        </Badge>
      ),
      hideBelow: 'sm',
    },
    {
      id: 'valor',
      header: 'Valor',
      numeric: true,
      cell: (l) => (
        <span className={l.tipo === 'receita' ? 'text-receita-700' : 'text-despesa-700'}>
          {l.tipo === 'receita' ? '+' : '−'}
          {formatBRL(l.valor)}
        </span>
      ),
    },
    { id: 'saldo', header: 'Saldo', numeric: true, cell: (l) => formatBRL(l.saldo) },
  ];

  return (
    <>
      <PageHeader
        titulo="Extrato"
        descricao="Lançamentos do período em ordem cronológica, com saldo corrido."
        voltar="/relatorios"
        acoes={
          <ExportarBotoes
            baixandoCsv={baixar.isPending && baixar.variables?.formato === 'csv'}
            baixandoPdf={baixar.isPending && baixar.variables?.formato === 'pdf'}
            onCsv={() => baixar.mutate({ formato: 'csv', query: filtros })}
            onPdf={() => baixar.mutate({ formato: 'pdf', query: filtros })}
          />
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <PeriodoSelect value={periodo} onChange={(v) => patch({ de: v.de, ate: v.ate })} />
          <div className="flex gap-2">
            <div className="w-40">
              <SimpleSelect
                aria-label="Tipo"
                value={tipo ?? ''}
                onValueChange={(v) => patch({ tipo: v || '' })}
                options={OPCOES_TIPO}
                opcaoVazia="Todos os tipos"
              />
            </div>
            <SimpleSelect
              aria-label="Situação"
              value={somentePagos ? 'pagos' : 'todos'}
              onValueChange={(v) => patch({ todos: v === 'todos' ? '1' : '' })}
              options={[
                { value: 'pagos', label: 'Só pagos' },
                { value: 'todos', label: 'Pagos e pendentes' },
              ]}
              className="w-44"
            />
          </div>
        </div>
      </PageHeader>

      <DataTable
        columns={colunas}
        data={dto?.linhas}
        rowKey={(l) => l.id}
        isLoading={query.isPending}
        isError={query.isError}
        error={query.error}
        onRetry={() => void query.refetch()}
        caption="Extrato de lançamentos"
        footer={
          dto
            ? `Saldo inicial: ${formatBRL(dto.saldoInicial)} · Entradas: ${formatBRL(dto.totais.receitas)} · Saídas: ${formatBRL(dto.totais.despesas)} · Saldo final: ${formatBRL(dto.totais.saldoFinal)}`
            : undefined
        }
        className="rounded-lg border border-borda bg-superficie"
      />
    </>
  );
}
