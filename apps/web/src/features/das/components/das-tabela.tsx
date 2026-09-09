// Tabela (desktop) / cartões (mobile) das 12 competências do DAS de um ano, com ações:
// marcar como pago, desfazer (com confirmação) e link para gerar a guia no PGMEI.
import { type DasAnoDto, type DasCompetenciaDto, detalhamentoDas } from '@meifin/shared';
import { CircleHelp, ExternalLink, Undo2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { StatCard } from '@/components/ui/stat-card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { descreverPrazo, formatData, formatMesExtenso, hojeSP, nomeMes } from '@/lib/format/date';
import { formatBRL } from '@/lib/format/money';
import { capitalizar, plural } from '@/lib/format/texto';

import { useDesfazerPagamentoDas } from '../hooks';
import { DasStatusBadge } from './das-status-badge';
import { PagamentoDasDialog } from './pagamento-das-dialog';

export const URL_PGMEI =
  'https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgmei.app/Identificacao';

function ValorComDetalhamento({ competencia }: { competencia: DasCompetenciaDto }) {
  const linhas = detalhamentoDas(competencia.detalhamento);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded tabular-nums underline decoration-dotted underline-offset-4 hover:text-primary-700"
          aria-label={`${formatBRL(competencia.valor)}. Ver composição do valor`}
        >
          {formatBRL(competencia.valor)}
          <CircleHelp className="size-3.5 text-zinc-400" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <ul className="space-y-0.5">
          {linhas.map((l) => (
            <li key={l.codigo} className="flex justify-between gap-4">
              <span>{l.rotulo}</span>
              <span className="tabular-nums">{formatBRL(l.valor)}</span>
            </li>
          ))}
          <li className="mt-1 flex justify-between gap-4 border-t border-white/20 pt-1 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatBRL(competencia.valor)}</span>
          </li>
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

function Vencimento({ competencia }: { competencia: DasCompetenciaDto }) {
  const hoje = hojeSP();
  const texto = formatData(competencia.vencimento);
  if (competencia.status === 'pendente' && competencia.devida) {
    return (
      <span>
        {texto}{' '}
        <span className="text-xs text-zinc-500">
          ({descreverPrazo(competencia.vencimento, hoje)})
        </span>
      </span>
    );
  }
  if (competencia.status === 'atrasado') {
    return (
      <span>
        {texto}{' '}
        <span className="text-xs text-despesa-700">
          ({plural(competencia.diasAtraso, 'dia', 'dias')} de atraso)
        </span>
      </span>
    );
  }
  return <span>{texto}</span>;
}

function Pagamento({ competencia }: { competencia: DasCompetenciaDto }) {
  const p = competencia.pagamento;
  if (!p) return <span className="text-zinc-400">—</span>;
  return (
    <span className="text-xs text-zinc-600">
      {formatBRL(p.valorPago)} em {formatData(p.dataPagamento)}
    </span>
  );
}

export function ResumoDas({ das }: { das: DasAnoDto }) {
  const pagas = das.competencias.filter((c) => c.status === 'pago').length;
  const pendentes = das.competencias.filter((c) => c.status === 'pendente' && c.devida).length;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <StatCard
        titulo="Pagos"
        valor={formatBRL(das.totais.pago)}
        tone="receita"
        rodape={`${plural(pagas, 'competência', 'competências')} em ${das.ano}`}
      />
      <StatCard
        titulo="A pagar"
        valor={formatBRL(das.totais.pendente)}
        tone={pendentes > 0 ? 'alerta' : 'neutral'}
        rodape={
          pendentes > 0 ? `${plural(pendentes, 'guia', 'guias')} dentro do prazo` : 'Nada pendente'
        }
      />
      <StatCard
        titulo="Em atraso"
        valor={formatBRL(das.totais.atrasado)}
        tone={das.totais.quantidadeAtrasadas > 0 ? 'despesa' : 'neutral'}
        rodape={
          das.totais.quantidadeAtrasadas > 0
            ? `${plural(das.totais.quantidadeAtrasadas, 'guia vencida', 'guias vencidas')} — gere a guia atualizada no PGMEI`
            : 'Nenhuma guia vencida'
        }
      />
    </div>
  );
}

export function DasTabela({ das }: { das: DasAnoDto }) {
  const [pagando, setPagando] = useState<DasCompetenciaDto | null>(null);
  const confirm = useConfirm();
  const desfazer = useDesfazerPagamentoDas();

  const aoDesfazer = async (c: DasCompetenciaDto) => {
    const ok = await confirm({
      titulo: `Desfazer o pagamento de ${formatMesExtenso(c.competencia)}?`,
      descricao:
        'A despesa registrada em "Impostos e DAS" será removida e o DAS volta a ficar pendente.',
      confirmarTexto: 'Desfazer',
      tom: 'destructive',
    });
    if (ok) desfazer.mutate(c.competencia);
  };

  const acoes = (c: DasCompetenciaDto) => {
    if (c.status === 'pago') {
      return (
        <Button
          variant="ghost"
          size="sm"
          icon={<Undo2 />}
          onClick={() => void aoDesfazer(c)}
          loading={desfazer.isPending && desfazer.variables === c.competencia}
          aria-label={`Desfazer pagamento de ${formatMesExtenso(c.competencia)}`}
        >
          Desfazer
        </Button>
      );
    }
    if (!c.devida || c.status === 'futuro') return null;
    return (
      // No cartão mobile as ações ficam ao lado do conteúdo num espaço estreito: empilha por
      // padrão e só vira linha a partir de md (onde as ações caem na última coluna da tabela).
      <div className="flex flex-col items-stretch gap-1 md:flex-row md:items-center md:justify-end">
        <Button variant="ghost" size="sm" asChild>
          <a href={URL_PGMEI} target="_blank" rel="noopener noreferrer">
            Gerar guia
            <ExternalLink aria-hidden="true" />
          </a>
        </Button>
        <Button
          size="sm"
          variant={c.status === 'atrasado' ? 'primary' : 'secondary'}
          onClick={() => setPagando(c)}
          aria-label={`Marcar DAS de ${formatMesExtenso(c.competencia)} como pago`}
        >
          Marcar como pago
        </Button>
      </div>
    );
  };

  const columns: DataTableColumn<DasCompetenciaDto>[] = [
    {
      id: 'competencia',
      header: 'Competência',
      cell: (c) => (
        <span className="font-medium">{capitalizar(formatMesExtenso(c.competencia))}</span>
      ),
    },
    { id: 'vencimento', header: 'Vencimento', cell: (c) => <Vencimento competencia={c} /> },
    {
      id: 'valor',
      header: 'Valor',
      numeric: true,
      cell: (c) => <ValorComDetalhamento competencia={c} />,
    },
    {
      id: 'status',
      header: 'Situação',
      cell: (c) => <DasStatusBadge status={c.status} devida={c.devida} />,
    },
    {
      id: 'pagamento',
      header: 'Pagamento',
      hideBelow: 'lg',
      cell: (c) => <Pagamento competencia={c} />,
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={das.competencias}
        rowKey={(c) => c.competencia}
        rowActions={acoes}
        caption={`DAS mensal de ${das.ano}`}
        rowClassName={(c) => (c.status === 'atrasado' ? 'bg-despesa-50/40' : undefined)}
        mobileCard={(c) => (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                {nomeMes(Number(c.competencia.slice(5, 7)), { capitalizar: true })}
              </span>
              <DasStatusBadge status={c.status} devida={c.devida} />
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-zinc-500">
                Vence <Vencimento competencia={c} />
              </span>
              <ValorComDetalhamento competencia={c} />
            </div>
            {c.pagamento ? (
              <div>
                <Pagamento competencia={c} />
              </div>
            ) : null}
          </div>
        )}
      />
      <PagamentoDasDialog
        competencia={pagando}
        onOpenChange={(open) => !open && setPagando(null)}
      />
    </>
  );
}
