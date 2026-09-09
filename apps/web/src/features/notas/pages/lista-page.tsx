// /notas-fiscais — filtros (tipo, status, período, contato, busca), badges de status, resumo do
// ano (emitidas/canceladas/sem receita + valores por mês) e diálogos: registrar, detalhe, cancelar.
// Diálogos controlados pela URL: ?novo=1, ?nota=<id>, ?cancelar=<id>.
import { STATUS_NOTA, TIPOS_NOTA, type NotaFiscalDto } from '@meifin/shared';
import { Eye, FileText, MoreHorizontal, Plus, Receipt, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { DateInput } from '@/components/ui/date-input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SimpleSelect } from '@/components/ui/select';
import { StatCard } from '@/components/ui/stat-card';
import { useContatosOpcoes } from '@/features/referencias';
import { formatData, hojeSP, nomeMes } from '@/lib/format/date';
import { formatBRL, formatBRLCompact } from '@/lib/format/money';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { useSearchParamsObject } from '@/lib/hooks/use-search-params-state';
import { opcoesDe, STATUS_NOTA_LABELS, TIPO_NOTA_LABELS } from '@/lib/labels';

import { CancelarNotaDialog } from '../components/cancelar-nota-dialog';
import { NotaDetalheDialog } from '../components/nota-detalhe-dialog';
import { RegistrarNotaDialog } from '../components/registrar-nota-dialog';
import { StatusNotaBadge, TipoNotaBadge } from '../components/status-nota-badge';
import { useNota, useNotas, useResumoNotas } from '../hooks';

const PAGE_SIZE = 25;
const OPCOES_TIPO = opcoesDe(TIPOS_NOTA, TIPO_NOTA_LABELS);
const OPCOES_STATUS = opcoesDe(STATUS_NOTA, STATUS_NOTA_LABELS);
const CHAVES = [
  'tipo',
  'status',
  'contatoId',
  'de',
  'ate',
  'q',
  'page',
  'novo',
  'nota',
  'cancelar',
] as const;

export function NotasListaPage() {
  const anoAtual = Number(hojeSP().slice(0, 4));
  const [params, patch] = useSearchParamsObject(CHAVES);
  const page = Math.max(1, Number(params.page) || 1);

  const [texto, setTexto] = useState(params.q);
  const buscaDebounced = useDebounce(texto.trim(), 300);
  useEffect(() => {
    if (buscaDebounced !== params.q) patch({ q: buscaDebounced, page: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaDebounced]);

  const contatos = useContatosOpcoes();
  const resumo = useResumoNotas(anoAtual);

  const query = useNotas({
    tipo: (params.tipo || undefined) as (typeof TIPOS_NOTA)[number] | undefined,
    status: (params.status || undefined) as (typeof STATUS_NOTA)[number] | undefined,
    contatoId: params.contatoId || undefined,
    de: params.de || undefined,
    ate: params.ate || undefined,
    busca: params.q || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const notaCancelar = useNota(params.cancelar);

  const colunas: DataTableColumn<NotaFiscalDto>[] = [
    {
      id: 'numero',
      header: 'Nota',
      cell: (n) => (
        <div className="min-w-0">
          <p className="font-medium text-texto">
            {n.numero}
            {n.serie ? <span className="text-zinc-500">/{n.serie}</span> : null}
          </p>
          <p className="text-xs text-zinc-500">{formatData(n.dataEmissao)}</p>
        </div>
      ),
    },
    { id: 'tipo', header: 'Tipo', cell: (n) => <TipoNotaBadge tipo={n.tipo} /> },
    {
      id: 'cliente',
      header: 'Cliente',
      hideBelow: 'md',
      cell: (n) => <span className="text-zinc-600">{n.contato?.nome ?? '—'}</span>,
    },
    { id: 'valor', header: 'Valor', numeric: true, cell: (n) => formatBRL(n.valor) },
    { id: 'status', header: 'Status', cell: (n) => <StatusNotaBadge status={n.status} /> },
    {
      id: 'receita',
      header: 'Receita',
      hideBelow: 'lg',
      cell: (n) =>
        n.lancamentoId ? (
          <span className="text-receita-700">Vinculada</span>
        ) : (
          <span className="text-zinc-400">—</span>
        ),
    },
  ];

  const acoes = (n: NotaFiscalDto) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Ações da nota ${n.numero}`}>
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => patch({ nota: n.id })}>
          <Eye /> Ver detalhes
        </DropdownMenuItem>
        {n.status === 'emitida' ? (
          <DropdownMenuItem destructive onSelect={() => patch({ cancelar: n.id })}>
            <X /> Cancelar
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const vazio =
    params.q || params.tipo || params.status || params.contatoId ? (
      <EmptyState
        icone={<Search aria-hidden="true" />}
        titulo="Nenhuma nota encontrada"
        descricao="Nada corresponde aos filtros atuais."
        acao={
          <Button
            variant="outline"
            icon={<X aria-hidden="true" />}
            onClick={() => patch({ q: '', tipo: '', status: '', contatoId: '', de: '', ate: '' })}
          >
            Limpar filtros
          </Button>
        }
      />
    ) : (
      <EmptyState
        icone={<Receipt aria-hidden="true" />}
        titulo="Nenhuma nota registrada"
        descricao="Registre suas notas fiscais (NF-e, NFS-e, NFC-e) para acompanhar emissões e gerar receitas automaticamente."
        acao={
          <Button icon={<Plus aria-hidden="true" />} onClick={() => patch({ novo: '1' })}>
            Registrar nota
          </Button>
        }
      />
    );

  const meta = query.data?.meta;

  return (
    <>
      <PageHeader
        titulo="Notas fiscais"
        descricao="Registro manual de NF-e, NFS-e e NFC-e emitidas."
        acoes={
          <Button icon={<Plus aria-hidden="true" />} onClick={() => patch({ novo: '1' })}>
            Registrar nota
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatCard
            titulo={`Emitidas em ${anoAtual}`}
            valor={formatBRL(resumo.data?.emitidas.valor ?? 0)}
            tone="receita"
            icone={<FileText aria-hidden="true" />}
            rodape={`${resumo.data?.emitidas.quantidade ?? 0} nota(s)`}
            loading={resumo.isPending}
          />
          <StatCard
            titulo="Sem receita vinculada"
            valor={String(resumo.data?.semLancamento.quantidade ?? 0)}
            tone={resumo.data && resumo.data.semLancamento.quantidade > 0 ? 'alerta' : 'neutral'}
            rodape={formatBRL(resumo.data?.semLancamento.valor ?? 0)}
            loading={resumo.isPending}
          />
          <StatCard
            titulo="Canceladas"
            valor={String(resumo.data?.canceladas.quantidade ?? 0)}
            tone="neutral"
            rodape={formatBRL(resumo.data?.canceladas.valor ?? 0)}
            loading={resumo.isPending}
          />
        </div>

        {resumo.data ? (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Notas por mês">
            {resumo.data.porMes.map((m) => {
              const mes = Number(m.competencia.slice(5, 7));
              return (
                <div
                  key={m.competencia}
                  className="flex w-20 shrink-0 flex-col items-center rounded-lg border border-borda bg-superficie px-2 py-2 text-center"
                >
                  <span className="text-xs font-medium text-zinc-500 uppercase">
                    {nomeMes(mes, { curto: true })}
                  </span>
                  <span className="mt-0.5 text-sm font-semibold tabular-nums">
                    {m.valor > 0 ? formatBRLCompact(m.valor) : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
          <div className="w-full md:w-56">
            <Input
              type="search"
              aria-label="Buscar notas"
              placeholder="Buscar por número ou descrição"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              prefixo={<Search className="size-4" aria-hidden="true" />}
              autoComplete="off"
            />
          </div>
          <div className="w-full md:w-40">
            <SimpleSelect
              aria-label="Tipo"
              value={params.tipo as (typeof TIPOS_NOTA)[number] | ''}
              onValueChange={(v) => patch({ tipo: v, page: '' })}
              options={OPCOES_TIPO}
              opcaoVazia="Todos os tipos"
              placeholder="Tipo"
            />
          </div>
          <div className="w-full md:w-40">
            <SimpleSelect
              aria-label="Status"
              value={params.status as (typeof STATUS_NOTA)[number] | ''}
              onValueChange={(v) => patch({ status: v, page: '' })}
              options={OPCOES_STATUS}
              opcaoVazia="Todos os status"
              placeholder="Status"
            />
          </div>
          <div className="w-full md:w-56">
            <Combobox
              aria-label="Cliente"
              value={params.contatoId || null}
              onChange={(v) => patch({ contatoId: v ?? '', page: '' })}
              options={contatos.opcoes}
              loading={contatos.isPending}
              placeholder="Cliente (todos)"
              clearable
            />
          </div>
          <div className="grid w-full grid-cols-2 gap-2 md:w-auto">
            <div className="grid gap-1">
              <Label htmlFor="notas-de" className="text-xs text-zinc-500">
                De
              </Label>
              <DateInput
                id="notas-de"
                value={params.de || null}
                max={params.ate || undefined}
                onChange={(v) => patch({ de: v ?? '', page: '' })}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="notas-ate" className="text-xs text-zinc-500">
                Até
              </Label>
              <DateInput
                id="notas-ate"
                value={params.ate || null}
                min={params.de || undefined}
                onChange={(v) => patch({ ate: v ?? '', page: '' })}
              />
            </div>
          </div>
        </div>
      </PageHeader>

      <DataTable
        columns={colunas}
        data={query.data?.data}
        rowKey={(n) => n.id}
        caption="Notas fiscais"
        isLoading={query.isPending}
        isError={query.isError}
        error={query.error}
        onRetry={() => void query.refetch()}
        empty={vazio}
        onRowClick={(n) => patch({ nota: n.id })}
        rowActions={acoes}
        mobileCard={(n) => (
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">
                {n.numero}
                {n.serie ? `/${n.serie}` : ''}
              </span>
              <TipoNotaBadge tipo={n.tipo} />
              <StatusNotaBadge status={n.status} />
            </div>
            <p className="mt-0.5 text-sm text-zinc-500">
              {[n.contato?.nome, formatData(n.dataEmissao), formatBRL(n.valor)]
                .filter(Boolean)
                .join(' · ')}
            </p>
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

      <RegistrarNotaDialog
        open={params.novo === '1'}
        onOpenChange={(open) => patch({ novo: open ? '1' : '' })}
      />
      <NotaDetalheDialog
        notaId={params.nota || null}
        onClose={() => patch({ nota: '' })}
        onCancelar={(nota) => patch({ nota: '', cancelar: nota.id })}
      />
      <CancelarNotaDialog
        nota={notaCancelar.data ?? null}
        onClose={() => patch({ cancelar: '' })}
      />
    </>
  );
}
