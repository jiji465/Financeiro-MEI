// /lancamentos/repeticoes — o que se repete todo mês.
//
// A API de recorrências existe desde o início, mas não havia tela: quem marcava "Repetir todo
// mês" num lançamento nunca mais conseguia ver, pausar, corrigir o valor nem encerrar. Esta
// página é só isso — a criação continua no diálogo de lançamento, junto do primeiro mês.
import type { RecorrenciaDto } from '@meifin/shared';
import { Pause, Pencil, Play, Repeat, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { formatData, formatMesExtenso } from '@/lib/format/date';
import { formatBRL } from '@/lib/format/money';

import { RepeticaoDialog } from '../components/repeticao-dialog';
import { useAtualizarRecorrencia, useExcluirRecorrencia, useRecorrencias } from '../hooks';

function LinhaAcoes({ r, onEditar }: { r: RecorrenciaDto; onEditar: (r: RecorrenciaDto) => void }) {
  const confirm = useConfirm();
  const atualizar = useAtualizarRecorrencia(r.id);
  const excluir = useExcluirRecorrencia();

  const confirmarExclusao = async () => {
    const ok = await confirm({
      titulo: `Encerrar "${r.descricao}"?`,
      // O usuário precisa saber o que NÃO acontece: os lançamentos já gerados continuam lá.
      descricao:
        'Para de gerar novos meses. Os lançamentos já criados por esta repetição continuam como estão — nada é apagado do histórico.',
      confirmarTexto: 'Encerrar',
      tom: 'destructive',
    });
    if (ok) excluir.mutate(r.id);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${r.descricao}`}>
          <Pencil aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onEditar(r)}>
          <Pencil /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => atualizar.mutate({ ativo: !r.ativo })}
          disabled={atualizar.isPending}
        >
          {r.ativo ? <Pause /> : <Play />}
          {r.ativo ? 'Pausar' : 'Retomar'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={() => void confirmarExclusao()}>
          <Trash2 /> Encerrar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RepeticoesPage() {
  const query = useRecorrencias();
  const [editando, setEditando] = useState<RecorrenciaDto | null>(null);
  const repeticoes = query.data ?? [];

  const colunas: DataTableColumn<RecorrenciaDto>[] = [
    {
      id: 'descricao',
      header: 'O que se repete',
      cell: (r) => (
        <div className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-texto">{r.descricao}</span>
            <Badge tone={r.tipo === 'receita' ? 'receita' : 'despesa'} className="font-normal">
              {r.tipo === 'receita' ? 'Receita' : 'Despesa'}
            </Badge>
            {!r.ativo ? (
              <Badge tone="neutral" className="font-normal">
                Pausada
              </Badge>
            ) : null}
          </span>
          <p className="truncate text-xs text-zinc-500">
            {[r.categoria?.nome, r.contato?.nome, r.contaBancaria?.nome]
              .filter(Boolean)
              .join(' · ') || 'Sem categoria'}
          </p>
        </div>
      ),
    },
    {
      id: 'valor',
      header: 'Valor',
      numeric: true,
      cell: (r) => (
        <span
          className={`font-semibold tabular-nums ${
            r.tipo === 'receita' ? 'text-receita-700' : 'text-despesa-700'
          }`}
        >
          {formatBRL(r.valor)}
        </span>
      ),
    },
    {
      id: 'dia',
      header: 'Todo dia',
      hideBelow: 'md',
      cell: (r) => <span className="text-zinc-600 tabular-nums">{r.diaDoMes}</span>,
    },
    {
      id: 'ate',
      header: 'Até',
      hideBelow: 'lg',
      cell: (r) =>
        r.dataFim ? (
          <span className="text-zinc-600">{formatData(r.dataFim)}</span>
        ) : (
          <span className="text-zinc-400">Sem fim</span>
        ),
    },
    {
      id: 'ultima',
      header: 'Último gerado',
      hideBelow: 'lg',
      cell: (r) =>
        r.ultimaCompetencia ? (
          <span className="text-zinc-600">{formatMesExtenso(r.ultimaCompetencia)}</span>
        ) : (
          <span className="text-zinc-400">—</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        titulo="Lançamentos repetidos"
        descricao="O que entra ou sai todo mês sem você precisar lançar de novo."
        voltar="/lancamentos"
      />

      <DataTable
        columns={colunas}
        data={repeticoes}
        rowKey={(r) => r.id}
        caption="Lançamentos repetidos"
        isLoading={query.isPending}
        isError={query.isError}
        error={query.error}
        onRetry={() => void query.refetch()}
        onRowClick={(r) => setEditando(r)}
        rowActions={(r) => <LinhaAcoes r={r} onEditar={setEditando} />}
        empty={
          <EmptyState
            icone={<Repeat aria-hidden="true" />}
            titulo="Nenhum lançamento repetido"
            descricao='Ao criar uma receita ou despesa, marque "Repetir todo mês" para o sistema lançar sozinho nos meses seguintes — aluguel, internet, mensalidade de cliente.'
          />
        }
        mobileCard={(r) => (
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{r.descricao}</span>
              <span
                className={`shrink-0 font-semibold tabular-nums ${
                  r.tipo === 'receita' ? 'text-receita-700' : 'text-despesa-700'
                }`}
              >
                {formatBRL(r.valor)}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">
              Todo dia {r.diaDoMes}
              {r.dataFim ? ` · até ${formatData(r.dataFim)}` : ''}
              {!r.ativo ? ' · Pausada' : ''}
            </p>
          </div>
        )}
        contorno
      />

      {repeticoes.length > 0 ? (
        <p className="mt-3 text-sm text-zinc-500">
          Os meses são gerados como <strong className="font-medium">pendentes</strong> — você
          confirma o pagamento quando ele acontecer. Pausar não apaga o que já foi gerado.
        </p>
      ) : null}

      <RepeticaoDialog repeticao={editando} onOpenChange={(open) => !open && setEditando(null)} />
    </>
  );
}
