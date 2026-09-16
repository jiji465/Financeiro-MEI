// /contas-bancarias — onde o dinheiro fica. Cadastro manual das contas do MEI com o saldo de
// cada uma (calculado na API a partir dos lançamentos pagos) e atalho para ver os lançamentos
// daquela conta. Sem integração bancária: nada aqui conversa com banco nenhum.
import type { ContaBancariaSaldoDto } from '@meifin/shared';
import { ArrowLeftRight, Banknote, ListFilter, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { StatCard } from '@/components/ui/stat-card';
import { formatBRL } from '@/lib/format/money';
import { TIPO_CONTA_BANCARIA_LABELS } from '@/lib/labels';

import { ContaBancariaDialog } from '../components/conta-bancaria-dialog';
import { TransferenciaDialog } from '../components/transferencia-dialog';
import { useContasBancarias, useExcluirContaBancaria } from '../hooks';

/** Lançamentos daquela conta, no ano corrente (a lista tem período próprio e começa no mês). */
function linkDosLancamentos(id: string): string {
  const ano = new Date().getFullYear();
  return `/lancamentos?contaBancariaId=${id}&de=${ano}-01-01&ate=${ano}-12-31`;
}

function classeSaldo(valor: number): string {
  if (valor < 0) return 'font-semibold text-despesa-700';
  return 'font-semibold text-texto';
}

export function ContasBancariasListaPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const excluir = useExcluirContaBancaria();
  const query = useContasBancarias();
  const [dialogo, setDialogo] = useState<{ conta?: ContaBancariaSaldoDto } | null>(null);
  const [transferindo, setTransferindo] = useState(false);

  const totais = query.data?.totais;
  const contas = query.data?.data;

  const confirmarExclusao = async (conta: ContaBancariaSaldoDto) => {
    const ok = await confirm({
      titulo: `Excluir "${conta.nome}"?`,
      descricao:
        conta.lancamentos > 0
          ? `A conta sai das listas e dos seletores. Os ${conta.lancamentos} lançamento(s) já vinculados continuam como estão, com os mesmos valores.`
          : 'A conta sai das listas e dos seletores.',
      confirmarTexto: 'Excluir',
      tom: 'destructive',
    });
    if (ok) excluir.mutate(conta.id);
  };

  const colunas: DataTableColumn<ContaBancariaSaldoDto>[] = [
    {
      id: 'nome',
      header: 'Conta',
      cell: (c) => (
        <div className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-texto">{c.nome}</span>
            {!c.ativo ? (
              <Badge tone="neutral" className="font-normal">
                Inativa
              </Badge>
            ) : null}
          </span>
          <p className="text-xs text-zinc-500">
            {[c.instituicao, TIPO_CONTA_BANCARIA_LABELS[c.tipo]].filter(Boolean).join(' · ')}
          </p>
        </div>
      ),
    },
    {
      id: 'saldoInicial',
      header: 'Saldo inicial',
      numeric: true,
      hideBelow: 'lg',
      cell: (c) => <span className="text-zinc-600 tabular-nums">{formatBRL(c.saldoInicial)}</span>,
    },
    {
      id: 'receitas',
      header: 'Entradas',
      numeric: true,
      hideBelow: 'md',
      cell: (c) => <span className="text-receita-700 tabular-nums">{formatBRL(c.receitas)}</span>,
    },
    {
      id: 'despesas',
      header: 'Saídas',
      numeric: true,
      hideBelow: 'md',
      cell: (c) => <span className="text-despesa-700 tabular-nums">{formatBRL(c.despesas)}</span>,
    },
    {
      id: 'transferencias',
      header: 'Transferências',
      numeric: true,
      hideBelow: 'lg',
      cell: (c) => {
        const liquido = c.transferenciasEntrada - c.transferenciasSaida;
        if (liquido === 0) return <span className="text-zinc-400">—</span>;
        return (
          <span className="text-zinc-600 tabular-nums" title="Entre as suas próprias contas">
            {liquido > 0 ? '+' : '−'}
            {formatBRL(Math.abs(liquido))}
          </span>
        );
      },
    },
    {
      id: 'saldo',
      header: 'Saldo atual',
      numeric: true,
      cell: (c) => (
        <span className={`${classeSaldo(c.saldo)} tabular-nums`}>{formatBRL(c.saldo)}</span>
      ),
    },
  ];

  const acoes = (c: ContaBancariaSaldoDto) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${c.nome}`}>
          <Pencil aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setDialogo({ conta: c })}>
          <Pencil /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate(linkDosLancamentos(c.id))}>
          <ListFilter /> Ver lançamentos
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={() => void confirmarExclusao(c)}>
          <Trash2 /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <PageHeader
        titulo="Contas bancárias"
        descricao="Onde o dinheiro entra e sai. O saldo é calculado pelos lançamentos pagos de cada conta."
        acoes={
          <>
            <Button
              variant="outline"
              icon={<ArrowLeftRight aria-hidden="true" />}
              onClick={() => setTransferindo(true)}
              disabled={(contas?.length ?? 0) < 2}
              title={
                (contas?.length ?? 0) < 2
                  ? 'Cadastre pelo menos duas contas para transferir entre elas'
                  : undefined
              }
            >
              Transferir
            </Button>
            <Button icon={<Plus aria-hidden="true" />} onClick={() => setDialogo({})}>
              Nova conta
            </Button>
          </>
        }
      >
        <Card className="grid gap-px overflow-hidden bg-borda sm:grid-cols-2">
          <StatCard
            semCard
            className="bg-superficie p-4"
            tamanho="sm"
            titulo="Saldo inicial somado"
            valor={formatBRL(totais?.saldoInicial ?? 0)}
            rodape="O que havia nas contas antes dos lançamentos"
            loading={query.isPending}
          />
          <StatCard
            semCard
            className="bg-superficie p-4"
            titulo="Saldo total hoje"
            valor={formatBRL(totais?.saldo ?? 0)}
            tone={(totais?.saldo ?? 0) < 0 ? 'despesa' : 'neutral'}
            rodape={`${contas?.length ?? 0} conta(s) cadastrada(s)`}
            loading={query.isPending}
          />
        </Card>
      </PageHeader>

      <DataTable
        columns={colunas}
        data={contas}
        rowKey={(c) => c.id}
        caption="Contas bancárias"
        isLoading={query.isPending}
        isError={query.isError}
        error={query.error}
        onRetry={() => void query.refetch()}
        onRowClick={(c) => setDialogo({ conta: c })}
        rowActions={acoes}
        empty={
          <EmptyState
            icone={<Banknote aria-hidden="true" />}
            titulo="Nenhuma conta cadastrada"
            descricao="Cadastre suas contas para dizer, em cada lançamento, onde o dinheiro caiu ou saiu — e acompanhar o saldo de cada uma."
            acao={
              <Button icon={<Plus aria-hidden="true" />} onClick={() => setDialogo({})}>
                Nova conta
              </Button>
            }
          />
        }
        mobileCard={(c) => (
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{c.nome}</span>
              <span className={`shrink-0 tabular-nums ${classeSaldo(c.saldo)}`}>
                {formatBRL(c.saldo)}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">
              {[c.instituicao, TIPO_CONTA_BANCARIA_LABELS[c.tipo]].filter(Boolean).join(' · ')}
              {!c.ativo ? ' · Inativa' : ''}
            </p>
          </div>
        )}
        contorno
      />

      {contas && contas.length > 0 ? (
        <p className="mt-3 text-sm text-zinc-500">
          Saldo = saldo inicial + receitas pagas − despesas pagas + transferências entre as suas
          contas. Lançamentos pendentes não entram, e transferência não conta como faturamento.{' '}
          <Link to="/lancamentos" className="text-primary-700 hover:underline">
            Ver lançamentos
          </Link>
        </p>
      ) : null}

      <ContaBancariaDialog
        conta={dialogo?.conta}
        aberto={dialogo !== null}
        onOpenChange={(open) => !open && setDialogo(null)}
      />

      <TransferenciaDialog aberto={transferindo} onOpenChange={setTransferindo} />
    </>
  );
}
