// /relatorios — hub com um card por relatório e atalhos de exportação rápida (lançamentos e
// contas), além do link para o assistente de importação de CSV (features/relatorios/importar).
import {
  ArrowRight,
  FileSpreadsheet,
  Landmark,
  ScrollText,
  TrendingUp,
  Upload,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';

import { useBaixarContas, useBaixarLancamentos } from '../hooks';

interface RelatorioCard {
  titulo: string;
  descricao: string;
  to: string;
  icone: ComponentType<{ className?: string }>;
}

const RELATORIOS: RelatorioCard[] = [
  {
    titulo: 'DRE simplificada',
    descricao: 'Receitas, despesas e resultado do período, por categoria.',
    to: '/relatorios/dre',
    icone: ScrollText,
  },
  {
    titulo: 'Extrato',
    descricao: 'Lançamentos do período com saldo corrido, prontos para conferência.',
    to: '/relatorios/extrato',
    icone: FileSpreadsheet,
  },
  {
    titulo: 'Faturamento x limite',
    descricao: 'Faturamento acumulado no ano frente ao limite anual do MEI, mês a mês.',
    to: '/relatorios/faturamento',
    icone: TrendingUp,
  },
  {
    titulo: 'DASN-SIMEI',
    descricao: 'Faturamento apurado por comércio/serviços e situação da declaração anual.',
    to: '/relatorios/dasn',
    icone: Landmark,
  },
];

function CardRelatorio({ titulo, descricao, to, icone: Icone }: RelatorioCard) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-lg border border-borda bg-superficie p-4 shadow-card transition-colors hover:bg-zinc-50 md:p-5"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
        <Icone className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-texto">{titulo}</p>
        <p className="mt-0.5 text-sm text-zinc-500">{descricao}</p>
      </div>
      <ArrowRight
        className="mt-2 size-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}

export function RelatoriosHubPage() {
  const baixarLancamentos = useBaixarLancamentos();
  const baixarContas = useBaixarContas();

  return (
    <>
      <PageHeader
        titulo="Relatórios"
        descricao="Consulte e exporte os relatórios do seu MEI em CSV ou PDF."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {RELATORIOS.map((r) => (
          <CardRelatorio key={r.to} {...r} />
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-borda bg-superficie p-4 md:p-5">
        <h2 className="font-semibold">Exportação rápida</h2>
        <p className="mt-0.5 text-sm text-zinc-500">
          Baixe todos os lançamentos ou todas as contas a pagar/receber sem filtros, em CSV.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            loading={baixarLancamentos.isPending}
            onClick={() => baixarLancamentos.mutate({ formato: 'csv', query: {} })}
          >
            Exportar lançamentos (CSV)
          </Button>
          <Button
            variant="outline"
            size="sm"
            loading={baixarContas.isPending}
            onClick={() => baixarContas.mutate({ formato: 'csv', query: {} })}
          >
            Exportar contas (CSV)
          </Button>
        </div>
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-lg border border-dashed border-borda p-4 md:p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
          <Upload className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-texto">Importar lançamentos de uma planilha</p>
          <p className="mt-0.5 text-sm text-zinc-500">
            Traga um CSV do seu banco ou de outra ferramenta; nós detectamos duplicados.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/relatorios/importar">Importar CSV</Link>
        </Button>
      </div>
    </>
  );
}
