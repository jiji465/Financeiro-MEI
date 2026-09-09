// /contatos/:id — ficha do contato: dados cadastrais, resumo financeiro (StatCards) e histórico de
// lançamentos filtrável por período (?de&ate&page).
import {
  type ContatoDto,
  type ContatoResumoDto,
  LABEL_TIPO_DOCUMENTO,
  type LancamentoDto,
} from '@meifin/shared';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Trash2,
  Wallet,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { PeriodoSelect } from '@/components/ui/periodo-select';
import { QueryState } from '@/components/ui/query-state';
import { PageSkeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { maskCEP } from '@/lib/format/cep';
import { formatData, isIsoDate, periodoPreset } from '@/lib/format/date';
import { formatDocumento } from '@/lib/format/documento';
import { formatBRL } from '@/lib/format/money';
import { formatTelefone } from '@/lib/format/telefone';
import { plural } from '@/lib/format/texto';
import { useSearchParamsObject } from '@/lib/hooks/use-search-params-state';

import { TipoContatoBadge } from '../components/tipo-contato-badge';
import { useContato, useContatoLancamentos, useContatoResumo, useExcluirContato } from '../hooks';

const PAGE_SIZE = 20;

function enderecoFormatado(e: ContatoDto['endereco']): string | null {
  const linha1 = [e.logradouro, e.numero].filter(Boolean).join(', ');
  const linha2 = [e.bairro, [e.cidade, e.uf].filter(Boolean).join('/')].filter(Boolean).join(' – ');
  const partes = [
    [linha1, e.complemento].filter(Boolean).join(' – '),
    linha2,
    e.cep ? `CEP ${maskCEP(e.cep)}` : null,
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(' · ') : null;
}

function DadosCard({ contato }: { contato: ContatoDto }) {
  const endereco = enderecoFormatado(contato.endereco);
  const itens: { icone: ReactNode; rotulo: string; valor: ReactNode }[] = [];
  if (contato.documento) {
    itens.push({
      icone: <Wallet aria-hidden="true" />,
      rotulo: contato.tipoDocumento ? LABEL_TIPO_DOCUMENTO[contato.tipoDocumento] : 'Documento',
      valor: <span className="tabular-nums">{formatDocumento(contato.documento)}</span>,
    });
  }
  if (contato.email) {
    itens.push({
      icone: <Mail aria-hidden="true" />,
      rotulo: 'E-mail',
      valor: (
        <a href={`mailto:${contato.email}`} className="text-primary-700 hover:underline">
          {contato.email}
        </a>
      ),
    });
  }
  if (contato.telefone) {
    itens.push({
      icone: <Phone aria-hidden="true" />,
      rotulo: 'Telefone',
      valor: (
        <a href={`tel:+55${contato.telefone}`} className="text-primary-700 hover:underline">
          {formatTelefone(contato.telefone)}
        </a>
      ),
    });
  }
  if (endereco) {
    itens.push({ icone: <MapPin aria-hidden="true" />, rotulo: 'Endereço', valor: endereco });
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados do contato</CardTitle>
      </CardHeader>
      <CardContent>
        {itens.length === 0 && !contato.observacoes ? (
          <p className="text-sm text-zinc-500">
            Nenhum dado adicional.{' '}
            <Link to={`/contatos/${contato.id}/editar`} className="text-primary-700 underline">
              Completar cadastro
            </Link>
          </p>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2">
            {itens.map((item) => (
              <div key={item.rotulo} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 text-zinc-400 [&_svg]:size-4">{item.icone}</span>
                <div className="min-w-0">
                  <dt className="text-xs text-zinc-500">{item.rotulo}</dt>
                  <dd className="break-words">{item.valor}</dd>
                </div>
              </div>
            ))}
            {contato.observacoes ? (
              <div className="text-sm sm:col-span-2">
                <dt className="text-xs text-zinc-500">Observações</dt>
                <dd className="whitespace-pre-line">{contato.observacoes}</dd>
              </div>
            ) : null}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function ResumoCards({ resumo, loading }: { resumo?: ContatoResumoDto; loading: boolean }) {
  const atrasado = (valor: number) =>
    valor > 0 ? `${formatBRL(valor)} em atraso` : 'Nada em atraso';
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        titulo="Recebido"
        valor={formatBRL(resumo?.totalReceitas ?? 0)}
        tone="receita"
        icone={<ArrowDownLeft aria-hidden="true" />}
        loading={loading}
        rodape="Receitas pagas"
      />
      <StatCard
        titulo="Pago"
        valor={formatBRL(resumo?.totalDespesas ?? 0)}
        tone="despesa"
        icone={<ArrowUpRight aria-hidden="true" />}
        loading={loading}
        rodape="Despesas pagas"
      />
      <StatCard
        titulo="A receber"
        valor={formatBRL(resumo?.aReceber ?? 0)}
        tone={resumo && resumo.atrasadoReceber > 0 ? 'alerta' : 'neutral'}
        icone={<Clock aria-hidden="true" />}
        loading={loading}
        rodape={resumo ? atrasado(resumo.atrasadoReceber) : undefined}
      />
      <StatCard
        titulo="A pagar"
        valor={formatBRL(resumo?.aPagar ?? 0)}
        tone={resumo && resumo.atrasadoPagar > 0 ? 'alerta' : 'neutral'}
        icone={<Clock aria-hidden="true" />}
        loading={loading}
        rodape={resumo ? atrasado(resumo.atrasadoPagar) : undefined}
      />
    </div>
  );
}

const COLUNAS_HISTORICO: DataTableColumn<LancamentoDto>[] = [
  {
    id: 'data',
    header: 'Data',
    cell: (l) => <span className="tabular-nums">{formatData(l.data)}</span>,
    className: 'w-28',
  },
  {
    id: 'descricao',
    header: 'Descrição',
    cell: (l) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{l.descricao}</p>
        {l.categoria ? <p className="text-xs text-zinc-500">{l.categoria.nome}</p> : null}
      </div>
    ),
  },
  {
    id: 'status',
    header: 'Situação',
    hideBelow: 'md',
    cell: (l) =>
      l.status === 'pago' ? (
        <Badge tone="receita" dot>
          Pago
        </Badge>
      ) : (
        <Badge tone="alerta" dot>
          Pendente
        </Badge>
      ),
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
];

function Historico({ id }: { id: string }) {
  const [params, patch] = useSearchParamsObject(['de', 'ate', 'page']);
  const padrao = periodoPreset('este_ano');
  const de = isIsoDate(params.de) ? params.de : padrao.de;
  const ate = isIsoDate(params.ate) ? params.ate : padrao.ate;
  const page = Math.max(1, Number(params.page) || 1);
  const query = useContatoLancamentos(id, { de, ate, page, pageSize: PAGE_SIZE });
  const meta = query.data?.meta;
  const totais = query.data?.totais;

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Histórico de lançamentos</CardTitle>
        <PeriodoSelect
          value={{ de, ate }}
          onChange={(p) => patch({ de: p.de, ate: p.ate, page: '' })}
          aria-label="Período do histórico"
        />
      </CardHeader>
      <CardContent>
        <DataTable
          columns={COLUNAS_HISTORICO}
          data={query.data?.data}
          rowKey={(l) => l.id}
          caption="Lançamentos do contato"
          isLoading={query.isPending}
          isError={query.isError}
          error={query.error}
          onRetry={() => void query.refetch()}
          empty={
            <EmptyState
              compacto
              titulo="Nenhum lançamento no período"
              descricao="Receitas e despesas vinculadas a este contato aparecem aqui."
            />
          }
          mobileCard={(l) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{l.descricao}</p>
                <p className="text-xs text-zinc-500">
                  {formatData(l.data)}
                  {l.categoria ? ` · ${l.categoria.nome}` : ''}
                  {l.status === 'pendente' ? ' · Pendente' : ''}
                </p>
              </div>
              <span
                className={`shrink-0 font-medium tabular-nums ${
                  l.tipo === 'receita' ? 'text-receita-700' : 'text-despesa-700'
                }`}
              >
                {l.tipo === 'receita' ? '+' : '−'}
                {formatBRL(l.valor)}
              </span>
            </div>
          )}
          footer={
            totais && (query.data?.data.length ?? 0) > 0 ? (
              <span className="flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  Receitas: <span className="text-receita-700">{formatBRL(totais.receitas)}</span>
                </span>
                <span>
                  Despesas: <span className="text-despesa-700">{formatBRL(totais.despesas)}</span>
                </span>
                <span>Saldo: {formatBRL(totais.saldo)}</span>
              </span>
            ) : undefined
          }
        />
        {meta ? (
          <Pagination
            className="mt-3"
            page={meta.page}
            pageSize={meta.pageSize}
            total={meta.total}
            onPageChange={(p) => patch({ page: p > 1 ? String(p) : '' })}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ContatoDetalhePage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const contato = useContato(id);
  const resumo = useContatoResumo(id);
  const excluir = useExcluirContato();

  const confirmarExclusao = async (c: ContatoDto) => {
    const ok = await confirm({
      titulo: `Excluir ${c.nome}?`,
      descricao:
        'O contato sai das listas e dos seletores. Lançamentos, contas e notas já vinculados continuam como estão.',
      confirmarTexto: 'Excluir',
      tom: 'destructive',
    });
    if (!ok) return;
    await excluir.mutateAsync(c.id);
    navigate('/contatos', { replace: true });
  };

  return (
    <QueryState query={contato} skeleton={<PageSkeleton />}>
      {(c) => (
        <>
          <PageHeader
            titulo={c.nome}
            voltar="/contatos"
            descricao={
              <span className="flex flex-wrap items-center gap-2">
                <TipoContatoBadge tipo={c.tipo} />
                {!c.ativo ? <Badge tone="outline">Inativo</Badge> : null}
                {resumo.data ? (
                  <span>
                    {plural(resumo.data.quantidadeLancamentos, 'lançamento')}
                    {resumo.data.ultimoLancamento
                      ? ` · último em ${formatData(resumo.data.ultimoLancamento)}`
                      : ''}
                    {resumo.data.notasFiscais > 0
                      ? ` · ${plural(resumo.data.notasFiscais, 'nota fiscal', 'notas fiscais')}`
                      : ''}
                  </span>
                ) : null}
              </span>
            }
            acoes={
              <>
                <Button variant="outline" asChild icon={<Pencil aria-hidden="true" />}>
                  <Link to={`/contatos/${c.id}/editar`}>Editar</Link>
                </Button>
                <Button
                  variant="outline"
                  className="text-perigo-700 hover:bg-perigo-50"
                  icon={<Trash2 aria-hidden="true" />}
                  onClick={() => void confirmarExclusao(c)}
                  loading={excluir.isPending}
                >
                  Excluir
                </Button>
              </>
            }
          />

          <div className="space-y-4">
            <ResumoCards resumo={resumo.data} loading={resumo.isPending} />
            <DadosCard contato={c} />
            <Historico id={c.id} />
          </div>
        </>
      )}
    </QueryState>
  );
}
