// /relatorios/dasn — relatório para preencher a DASN-SIMEI: faturamento apurado por
// comércio/serviços, prazo e situação da declaração do ano-base. Só leitura e exportação; marcar
// a declaração como entregue é feito na página de obrigações (/das).
import { LABEL_STATUS_DASN } from '@meifin/shared';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router';

import { Badge, type BadgeTone } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { SimpleSelect } from '@/components/ui/select';
import { formatData, formatMesAno, hojeSP } from '@/lib/format/date';
import { formatBRL } from '@/lib/format/money';
import { useSearchParamsObject } from '@/lib/hooks/use-search-params-state';

import { ExportarBotoes } from '../components/exportar-botoes';
import { useBaixarDasn, useDasnRelatorio } from '../hooks';

interface LinhaMes {
  competencia: string;
  comercio: number;
  servicos: number;
  semGrupo: number;
  total: number;
  dasPago: boolean;
}

const TONE_STATUS: Record<string, BadgeTone> = { pendente: 'alerta', entregue: 'receita' };

function anosBaseDisponiveis(hoje: string): { value: string; label: string }[] {
  const anoAtual = Number(hoje.slice(0, 4));
  return Array.from({ length: 4 }, (_, i) => anoAtual - i).map((a) => ({
    value: String(a),
    label: String(a),
  }));
}

export function DasnPage() {
  const [params, patch] = useSearchParamsObject(['ano']);
  const anoBase = Number(params.ano) || Number(hojeSP().slice(0, 4)) - 1;

  const query = useDasnRelatorio({ ano: anoBase });
  const baixar = useBaixarDasn();
  const dto = query.data;

  const colunas: DataTableColumn<LinhaMes>[] = [
    { id: 'mes', header: 'Mês', cell: (m) => formatMesAno(m.competencia) },
    {
      id: 'comercio',
      header: 'Comércio/indústria',
      numeric: true,
      cell: (m) => formatBRL(m.comercio),
    },
    { id: 'servicos', header: 'Serviços', numeric: true, cell: (m) => formatBRL(m.servicos) },
    { id: 'total', header: 'Total', numeric: true, cell: (m) => formatBRL(m.total) },
    {
      id: 'das',
      header: 'DAS',
      cell: (m) => (
        <Badge tone={m.dasPago ? 'receita' : 'alerta'}>{m.dasPago ? 'Pago' : 'Pendente'}</Badge>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        titulo="Relatório para a DASN-SIMEI"
        descricao="Faturamento apurado do ano-base, separado por comércio/indústria e serviços."
        voltar="/relatorios"
        acoes={
          <ExportarBotoes
            baixandoCsv={baixar.isPending && baixar.variables?.formato === 'csv'}
            baixandoPdf={baixar.isPending && baixar.variables?.formato === 'pdf'}
            onCsv={() => baixar.mutate({ formato: 'csv', query: { ano: anoBase } })}
            onPdf={() => baixar.mutate({ formato: 'pdf', query: { ano: anoBase } })}
          />
        }
      >
        <div className="w-32">
          <SimpleSelect
            aria-label="Ano-base"
            value={String(anoBase)}
            onValueChange={(v) => patch({ ano: v })}
            options={anosBaseDisponiveis(hojeSP())}
          />
        </div>
      </PageHeader>

      {dto ? (
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-borda bg-superficie p-4 md:p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-zinc-500">Situação da declaração</span>
              <Badge tone={TONE_STATUS[dto.status]}>{LABEL_STATUS_DASN[dto.status]}</Badge>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">
              {formatBRL(dto.faturamentoApurado)}
            </p>
            <p className="text-xs text-zinc-500">
              Faturamento apurado · comércio {formatBRL(dto.receitaComercio)} · serviços{' '}
              {formatBRL(dto.receitaServicos)}
            </p>
            <p className="mt-3 text-sm text-zinc-600">
              Prazo de entrega: {formatData(dto.prazo)}
              {dto.atrasada ? (
                <span className="ml-1 font-medium text-despesa-700">(atrasada)</span>
              ) : null}
            </p>
            <Link
              to="/das"
              className="mt-2 inline-block text-sm font-medium text-primary-700 underline-offset-4 hover:underline"
            >
              Marcar como entregue em Obrigações
            </Link>
          </div>

          <div className="rounded-lg border border-borda bg-superficie p-4 md:p-5">
            {dto.dasPendentes.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-receita-700">
                <CircleCheck className="size-5 shrink-0" aria-hidden="true" />
                Todos os DAS do ano-base estão pagos.
              </p>
            ) : (
              <p className="flex items-start gap-2 text-sm text-despesa-700">
                <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                DAS pendentes: {dto.dasPendentes.map((c) => formatMesAno(c)).join(', ')}.
              </p>
            )}
            {dto.alertaSemGrupo ? (
              <p className="mt-2 flex items-start gap-2 text-sm text-alerta-700">
                <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                Há receitas em categorias sem grupo DASN ({formatBRL(dto.receitaSemGrupo)}).
                Classifique-as como comércio ou serviços em Configurações.
              </p>
            ) : null}
          </div>
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
        caption="Faturamento por mês (DASN)"
        className="rounded-lg border border-borda bg-superficie"
      />
    </>
  );
}
