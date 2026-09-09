// /contas/pagar e /contas/receber — grupos por vencimento (vencidas, hoje, 7 dias, 30 dias,
// depois), filtros (busca, contato, status, só atrasadas), cards de resumo e baixa rápida.
// Diálogos controlados pela URL: ?novo=1 (nova conta), ?conta=<tituloId> (detalhe), ?pagar=<parcelaId> (baixa).
import {
  STATUS_PARCELA,
  type ParcelaComTituloDto,
  type StatusParcela,
  type TipoTitulo,
} from '@meifin/shared';
import { Clock, Plus, Search, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { QueryState } from '@/components/ui/query-state';
import { SimpleSelect } from '@/components/ui/select';
import { SkeletonText } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useContatosOpcoes } from '@/features/referencias';
import { formatData } from '@/lib/format/date';
import { formatBRL } from '@/lib/format/money';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { useSearchParamsObject } from '@/lib/hooks/use-search-params-state';
import { opcoesDe, STATUS_PARCELA_LABELS } from '@/lib/labels';

import { BaixaDialog } from '../components/baixa-dialog';
import { NovaContaDialog } from '../components/nova-conta-dialog';
import { StatusParcelaBadge, TituloDetalheDialog } from '../components/titulo-detalhe-dialog';
import { useParcelas, useResumoParcelas } from '../hooks';
import { agruparPorVencimento, TEXTOS_POR_TIPO } from '../utils';

const PAGE_SIZE = 100;
const STATUS_OPCOES = opcoesDe(STATUS_PARCELA, STATUS_PARCELA_LABELS);
const CHAVES = ['status', 'contatoId', 'atrasadas', 'q', 'page', 'novo', 'conta', 'pagar'] as const;

function LinhaParcela({
  item,
  tipo,
  onAbrir,
  onBaixar,
}: {
  item: ParcelaComTituloDto;
  tipo: TipoTitulo;
  onAbrir: (tituloId: string) => void;
  onBaixar: (parcelaId: string) => void;
}) {
  const textos = TEXTOS_POR_TIPO[tipo];
  return (
    <li
      className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm hover:bg-zinc-50"
      onClick={() => onAbrir(item.titulo.id)}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-texto">
          {item.titulo.descricao}
          {item.titulo.numeroParcelas > 1 ? (
            <span className="ml-1 font-normal text-zinc-500">
              ({item.numero}/{item.titulo.numeroParcelas})
            </span>
          ) : null}
        </p>
        <p className="truncate text-xs text-zinc-500">
          {item.titulo.contato?.nome ?? `${textos.contatoLabel} não informado`}
        </p>
      </div>
      <span className="w-24 shrink-0 tabular-nums text-zinc-600">
        {formatData(item.vencimento)}
      </span>
      <span className="w-28 shrink-0 text-right font-semibold tabular-nums">
        {formatBRL(item.valor)}
      </span>
      <StatusParcelaBadge parcela={item} />
      {item.status === 'aberta' ? (
        <Button
          size="sm"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            onBaixar(item.id);
          }}
        >
          {textos.baixar}
        </Button>
      ) : null}
    </li>
  );
}

function ListaContas({ tipo }: { tipo: TipoTitulo }) {
  const navigate = useNavigate();
  const textos = TEXTOS_POR_TIPO[tipo];
  const [params, patch] = useSearchParamsObject(CHAVES);
  const page = Math.max(1, Number(params.page) || 1);

  const [texto, setTexto] = useState(params.q);
  const buscaDebounced = useDebounce(texto.trim(), 300);
  useEffect(() => {
    if (buscaDebounced !== params.q) patch({ q: buscaDebounced, page: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaDebounced]);

  const contatos = useContatosOpcoes();
  const resumo = useResumoParcelas(30);
  const resumoTipo = resumo.data?.[tipo];

  const query = useParcelas({
    tipo,
    status: (params.status || undefined) as StatusParcela | undefined,
    contatoId: params.contatoId || undefined,
    atrasadas: params.atrasadas === '1' ? true : undefined,
    busca: params.q || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const meta = query.data?.meta;

  const vazio = (
    <EmptyState
      icone={<Wallet aria-hidden="true" />}
      titulo={textos.vazio}
      descricao="Cadastre a conta e as parcelas para acompanhar os vencimentos e baixar os pagamentos."
      acao={
        <Button icon={<Plus aria-hidden="true" />} onClick={() => patch({ novo: '1' })}>
          {textos.novo}
        </Button>
      }
    />
  );

  return (
    <>
      <PageHeader
        titulo={textos.titulo}
        descricao={
          tipo === 'pagar'
            ? 'Fornecedores, boletos e despesas parceladas.'
            : 'Vendas a prazo e recebimentos de clientes.'
        }
        acoes={
          <Button icon={<Plus aria-hidden="true" />} onClick={() => patch({ novo: '1' })}>
            {textos.novo}
          </Button>
        }
      >
        <Tabs value={tipo} onValueChange={(v) => navigate(`/contas/${v}`)}>
          <TabsList aria-label="Tipo de conta">
            <TabsTrigger value="pagar">Contas a pagar</TabsTrigger>
            <TabsTrigger value="receber">Contas a receber</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            titulo="Atrasadas"
            valor={formatBRL(resumoTipo?.atrasadas.valor ?? 0)}
            tone="despesa"
            icone={<Clock aria-hidden="true" />}
            rodape={`${resumoTipo?.atrasadas.quantidade ?? 0} parcela(s)`}
            loading={resumo.isPending}
          />
          <StatCard
            titulo="Próximos 30 dias"
            valor={formatBRL(resumoTipo?.proximas.valor ?? 0)}
            tone="alerta"
            rodape={`${resumoTipo?.proximas.quantidade ?? 0} parcela(s)`}
            loading={resumo.isPending}
          />
          <StatCard
            titulo="Em aberto"
            valor={formatBRL(resumoTipo?.abertas.valor ?? 0)}
            tone="primary"
            rodape={`${resumoTipo?.abertas.quantidade ?? 0} parcela(s)`}
            loading={resumo.isPending}
          />
          <StatCard
            titulo={textos.baixado}
            valor={formatBRL(resumoTipo?.pagasNoPeriodo.valor ?? 0)}
            tone="receita"
            rodape="Últimos 30 dias"
            loading={resumo.isPending}
          />
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
          <div className="w-full md:w-64">
            <Input
              type="search"
              aria-label={`Buscar ${textos.plural}`}
              placeholder="Buscar por descrição"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              prefixo={<Search className="size-4" aria-hidden="true" />}
              autoComplete="off"
            />
          </div>
          <div className="w-full md:w-56">
            <Combobox
              aria-label={textos.contatoLabel}
              value={params.contatoId || null}
              onChange={(v) => patch({ contatoId: v ?? '', page: '' })}
              options={contatos.opcoes}
              loading={contatos.isPending}
              placeholder={`${textos.contatoLabel} (todos)`}
              clearable
            />
          </div>
          <div className="w-full md:w-44">
            <SimpleSelect
              aria-label="Status"
              value={(params.status || '') as StatusParcela | ''}
              onValueChange={(v) => patch({ status: v, page: '' })}
              options={STATUS_OPCOES}
              opcaoVazia="Todas"
              placeholder="Status"
            />
          </div>
          <Switch
            label="Só atrasadas"
            checked={params.atrasadas === '1'}
            onCheckedChange={(v) => patch({ atrasadas: v ? '1' : '', page: '' })}
          />
        </div>
      </PageHeader>

      <QueryState
        query={query}
        skeleton={<SkeletonText linhas={6} />}
        isEmpty={(d) => d.data.length === 0}
        empty={vazio}
      >
        {(dados) => {
          const grupos = agruparPorVencimento(dados.data);
          return (
            <div className="space-y-5">
              {grupos.map((g) => (
                <section key={g.grupo}>
                  <div className="mb-2 flex items-center justify-between px-1">
                    <h2 className="text-sm font-semibold text-zinc-700">
                      {g.label}{' '}
                      <span className="font-normal text-zinc-500">({g.itens.length})</span>
                    </h2>
                    <span className="text-sm font-semibold tabular-nums">{formatBRL(g.total)}</span>
                  </div>
                  <ul
                    className="divide-y divide-borda rounded-lg border border-borda bg-superficie"
                    aria-label={g.label}
                  >
                    {g.itens.map((item) => (
                      <LinhaParcela
                        key={item.id}
                        item={item}
                        tipo={tipo}
                        onAbrir={(id) => patch({ conta: id })}
                        onBaixar={(id) => patch({ pagar: id })}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          );
        }}
      </QueryState>

      {meta && meta.total > PAGE_SIZE ? (
        <Pagination
          className="mt-4"
          page={meta.page}
          pageSize={meta.pageSize}
          total={meta.total}
          onPageChange={(p) => patch({ page: p > 1 ? String(p) : '' })}
        />
      ) : null}

      <NovaContaDialog
        tipo={tipo}
        open={params.novo === '1'}
        onOpenChange={(open) => patch({ novo: open ? '1' : '' })}
      />
      <TituloDetalheDialog
        tituloId={params.conta || null}
        onClose={() => patch({ conta: '' })}
        onBaixar={(parcelaId) => patch({ conta: '', pagar: parcelaId })}
      />
      <BaixaDialog parcelaId={params.pagar || null} onClose={() => patch({ pagar: '' })} />
    </>
  );
}

export function ContasPagarPage() {
  return <ListaContas tipo="pagar" />;
}

export function ContasReceberPage() {
  return <ListaContas tipo="receber" />;
}
