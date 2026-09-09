// /lancamentos — lista com filtros na URL (período, tipo, status, categoria, contato, origem,
// busca, página) + drawer de criação (?novo=receita|despesa) e edição (?editar=<id>).
import {
  ORIGENS_LANCAMENTO,
  STATUS_LANCAMENTO,
  type LancamentoDto,
  type OrigemLancamento,
  type StatusLancamento,
  type TipoLancamento,
} from '@meifin/shared';
import {
  ArrowLeftRight,
  CircleCheck,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
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
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { PeriodoSelect, type PeriodoValue } from '@/components/ui/periodo-select';
import { SimpleSelect } from '@/components/ui/select';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { categoriasParaOpcoes, useCategorias, useContatosOpcoes } from '@/features/referencias';
import { formatData, hojeSP, periodoPreset, presetDoPeriodo } from '@/lib/format/date';
import { formatBRL, formatBRLComSinal } from '@/lib/format/money';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { useSearchParamsObject } from '@/lib/hooks/use-search-params-state';
import { opcoesDe, ORIGEM_LANCAMENTO_LABELS, STATUS_LANCAMENTO_LABELS } from '@/lib/labels';

import { LancamentoDialog } from '../components/lancamento-dialog';
import { OrigemLancamentoBadge, StatusLancamentoBadge } from '../components/lancamento-badges';
import {
  useExcluirLancamento,
  useLancamentos,
  usePagarLancamento,
  useResumoLancamentos,
} from '../hooks';
import { exclusaoBloqueada } from '../utils';

const PAGE_SIZE = 25;
const STATUS_OPCOES = opcoesDe(STATUS_LANCAMENTO, STATUS_LANCAMENTO_LABELS);
const ORIGEM_OPCOES = opcoesDe(ORIGENS_LANCAMENTO, ORIGEM_LANCAMENTO_LABELS);
const CHAVES = [
  'de',
  'ate',
  'tipo',
  'status',
  'categoriaId',
  'contatoId',
  'origem',
  'q',
  'page',
  'novo',
  'editar',
] as const;

export function LancamentosListaPage() {
  const confirm = useConfirm();
  const pagar = usePagarLancamento();
  const excluir = useExcluirLancamento();
  const [params, patch] = useSearchParamsObject(CHAVES);
  const page = Math.max(1, Number(params.page) || 1);

  const [texto, setTexto] = useState(params.q);
  const buscaDebounced = useDebounce(texto.trim(), 300);
  useEffect(() => {
    if (buscaDebounced !== params.q) patch({ q: buscaDebounced, page: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaDebounced]);

  const hoje = hojeSP();
  const padrao = periodoPreset('este_mes', hoje);
  const periodo: PeriodoValue = {
    de: params.de || padrao.de,
    ate: params.ate || padrao.ate,
    preset:
      params.de || params.ate
        ? presetDoPeriodo({ de: params.de || padrao.de, ate: params.ate || padrao.ate }, hoje)
        : 'este_mes',
  };

  const tipoFiltro = (params.tipo || undefined) as TipoLancamento | undefined;
  const categorias = useCategorias(tipoFiltro);
  const contatos = useContatosOpcoes();
  const resumo = useResumoLancamentos({ de: periodo.de, ate: periodo.ate });

  const query = useLancamentos({
    de: periodo.de,
    ate: periodo.ate,
    tipo: tipoFiltro,
    status: (params.status || undefined) as StatusLancamento | undefined,
    categoriaId: params.categoriaId || undefined,
    contatoId: params.contatoId || undefined,
    origem: (params.origem || undefined) as OrigemLancamento | undefined,
    busca: params.q || undefined,
    page,
    pageSize: PAGE_SIZE,
    ordenarPor: 'data',
    ordem: 'desc',
  });
  const meta = query.data?.meta;

  const confirmarExclusao = async (lancamento: LancamentoDto) => {
    const ok = await confirm({
      titulo: `Excluir "${lancamento.descricao}"?`,
      descricao: 'Essa ação não pode ser desfeita.',
      confirmarTexto: 'Excluir',
      tom: 'destructive',
    });
    if (ok) excluir.mutate(lancamento.id);
  };

  const colunas: DataTableColumn<LancamentoDto>[] = [
    {
      id: 'data',
      header: 'Data',
      cell: (l) => <span className="text-zinc-600 tabular-nums">{formatData(l.data)}</span>,
    },
    {
      id: 'descricao',
      header: 'Descrição',
      cell: (l) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-texto">{l.descricao}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            {l.categoria ? <span className="text-xs text-zinc-500">{l.categoria.nome}</span> : null}
            {l.anexo ? <Paperclip aria-hidden="true" className="size-3 text-zinc-400" /> : null}
            <OrigemLancamentoBadge origem={l.origem} />
          </div>
        </div>
      ),
    },
    {
      id: 'contato',
      header: 'Contato',
      hideBelow: 'lg',
      cell: (l) => <span className="text-zinc-600">{l.contato?.nome ?? '—'}</span>,
    },
    {
      id: 'valor',
      header: 'Valor',
      numeric: true,
      cell: (l) => (
        <span
          className={
            l.tipo === 'receita'
              ? 'font-semibold text-receita-700'
              : 'font-semibold text-despesa-700'
          }
        >
          {formatBRLComSinal(l.tipo === 'receita' ? l.valor : -l.valor)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      hideBelow: 'md',
      cell: (l) => <StatusLancamentoBadge status={l.status} />,
    },
  ];

  const acoes = (l: LancamentoDto) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${l.descricao}`}>
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {l.status === 'pendente' ? (
          <DropdownMenuItem
            onSelect={() => pagar.mutate({ id: l.id, body: {} })}
            disabled={pagar.isPending}
          >
            <CircleCheck /> Marcar como pago
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={() => patch({ editar: l.id })}>
          <Pencil /> Editar
        </DropdownMenuItem>
        {!exclusaoBloqueada(l) ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => void confirmarExclusao(l)}>
              <Trash2 /> Excluir
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const vazio = params.q ? (
    <EmptyState
      icone={<Search aria-hidden="true" />}
      titulo="Nenhum lançamento encontrado"
      descricao={`Nada corresponde a “${params.q}” no período selecionado.`}
      acao={
        <Button variant="outline" onClick={() => setTexto('')}>
          Limpar busca
        </Button>
      }
    />
  ) : (
    <EmptyState
      icone={<ArrowLeftRight aria-hidden="true" />}
      titulo="Nenhum lançamento neste período"
      descricao="Registre uma receita ou despesa, ou importe um extrato em CSV."
      acao={
        <div className="flex flex-wrap justify-center gap-2">
          <Button icon={<Plus aria-hidden="true" />} onClick={() => patch({ novo: 'receita' })}>
            Nova receita
          </Button>
          <Button variant="outline" asChild>
            <Link to="/relatorios/importar">Importar CSV</Link>
          </Button>
        </div>
      }
    />
  );

  return (
    <>
      <PageHeader
        titulo="Lançamentos"
        descricao="Suas receitas e despesas, uma por uma."
        acoes={
          <>
            <Button variant="outline" asChild>
              <Link to="/relatorios/importar">Importar CSV</Link>
            </Button>
            <Button icon={<Plus aria-hidden="true" />} onClick={() => patch({ novo: 'despesa' })}>
              Nova despesa
            </Button>
            <Button icon={<Plus aria-hidden="true" />} onClick={() => patch({ novo: 'receita' })}>
              Nova receita
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            titulo="Receitas pagas"
            valor={formatBRL(resumo.data?.receitas.pagos ?? 0)}
            tone="receita"
            rodape={`${resumo.data?.receitas.quantidade ?? 0} lançamento(s)`}
            loading={resumo.isPending}
          />
          <StatCard
            titulo="Despesas pagas"
            valor={formatBRL(resumo.data?.despesas.pagos ?? 0)}
            tone="despesa"
            rodape={`${resumo.data?.despesas.quantidade ?? 0} lançamento(s)`}
            loading={resumo.isPending}
          />
          <StatCard
            titulo="Saldo do período"
            valor={formatBRL(resumo.data?.saldo ?? 0)}
            tone="primary"
            rodape="Receitas pagas − despesas pagas"
            loading={resumo.isPending}
          />
        </div>

        <PeriodoSelect
          value={periodo}
          onChange={(v) => patch({ de: v.de, ate: v.ate, page: '' })}
          className="w-full"
        />

        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
          <div className="w-full md:w-64">
            <Input
              type="search"
              aria-label="Buscar lançamentos"
              placeholder="Buscar por descrição"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              prefixo={<Search className="size-4" aria-hidden="true" />}
              autoComplete="off"
            />
          </div>
          <div className="w-full md:w-52">
            <Combobox
              aria-label="Categoria"
              value={params.categoriaId || null}
              onChange={(v) => patch({ categoriaId: v ?? '', page: '' })}
              options={categoriasParaOpcoes(categorias.data)}
              loading={categorias.isPending}
              placeholder="Categoria (todas)"
              clearable
            />
          </div>
          <div className="w-full md:w-52">
            <Combobox
              aria-label="Contato"
              value={params.contatoId || null}
              onChange={(v) => patch({ contatoId: v ?? '', page: '' })}
              options={contatos.opcoes}
              loading={contatos.isPending}
              placeholder="Contato (todos)"
              clearable
            />
          </div>
          <div className="w-full md:w-40">
            <SimpleSelect
              aria-label="Status"
              value={(params.status || '') as StatusLancamento | ''}
              onValueChange={(v) => patch({ status: v, page: '' })}
              options={STATUS_OPCOES}
              opcaoVazia="Status (todos)"
              placeholder="Status"
            />
          </div>
          <div className="w-full md:w-44">
            <SimpleSelect
              aria-label="Origem"
              value={(params.origem || '') as OrigemLancamento | ''}
              onValueChange={(v) => patch({ origem: v, page: '' })}
              options={ORIGEM_OPCOES}
              opcaoVazia="Origem (todas)"
              placeholder="Origem"
            />
          </div>
        </div>

        <Tabs
          value={tipoFiltro ?? 'todos'}
          onValueChange={(v) => patch({ tipo: v === 'todos' ? '' : v, categoriaId: '', page: '' })}
        >
          <TabsList aria-label="Filtrar por tipo">
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="receita">Receitas</TabsTrigger>
            <TabsTrigger value="despesa">Despesas</TabsTrigger>
          </TabsList>
        </Tabs>
      </PageHeader>

      <DataTable
        columns={colunas}
        data={query.data?.data}
        rowKey={(l) => l.id}
        caption="Lançamentos"
        isLoading={query.isPending}
        isError={query.isError}
        error={query.error}
        onRetry={() => void query.refetch()}
        empty={vazio}
        onRowClick={(l) => patch({ editar: l.id })}
        rowActions={acoes}
        mobileCard={(l) => (
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate font-medium">{l.descricao}</p>
              <span
                className={
                  l.tipo === 'receita'
                    ? 'shrink-0 font-semibold text-receita-700'
                    : 'shrink-0 font-semibold text-despesa-700'
                }
              >
                {formatBRLComSinal(l.tipo === 'receita' ? l.valor : -l.valor)}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
              <span className="tabular-nums">{formatData(l.data)}</span>
              {l.categoria ? <span>· {l.categoria.nome}</span> : null}
              <StatusLancamentoBadge status={l.status} />
              <OrigemLancamentoBadge origem={l.origem} />
            </div>
          </div>
        )}
        className="rounded-lg border border-borda bg-superficie md:p-2"
      />

      {meta ? (
        <Pagination
          className="mt-4"
          page={meta.page}
          pageSize={meta.pageSize}
          total={meta.total}
          onPageChange={(p) => patch({ page: p > 1 ? String(p) : '' })}
        />
      ) : null}

      <LancamentoDialog
        novo={params.novo}
        editar={params.editar}
        onClose={() => patch({ novo: '', editar: '' })}
      />
    </>
  );
}
