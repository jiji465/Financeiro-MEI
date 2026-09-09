// /contatos — abas Clientes / Fornecedores / Todos (?tipo), busca com debounce (?q), paginação
// (?page). Tabela no desktop, cartões no mobile; ações editar/excluir com confirmação.
import type { ContatoDto, TipoContato } from '@meifin/shared';
import { Eye, MoreHorizontal, Pencil, Plus, Search, Trash2, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';

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
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDocumento } from '@/lib/format/documento';
import { formatTelefone } from '@/lib/format/telefone';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { useSearchParamsObject } from '@/lib/hooks/use-search-params-state';

import { TipoContatoBadge } from '../components/tipo-contato-badge';
import { useContatos, useExcluirContato } from '../hooks';

const ABAS: { value: TipoContato | 'todos'; label: string }[] = [
  { value: 'cliente', label: 'Clientes' },
  { value: 'fornecedor', label: 'Fornecedores' },
  { value: 'todos', label: 'Todos' },
];

const PAGE_SIZE = 25;

function abaValida(valor: string): TipoContato | 'todos' {
  return valor === 'cliente' || valor === 'fornecedor' || valor === 'ambos' ? valor : 'todos';
}

export function ContatosListaPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const excluir = useExcluirContato();
  const [params, patch] = useSearchParamsObject(['tipo', 'q', 'page']);
  const aba = abaValida(params.tipo);
  const page = Math.max(1, Number(params.page) || 1);

  const [texto, setTexto] = useState(params.q);
  const buscaDebounced = useDebounce(texto.trim(), 300);
  useEffect(() => {
    if (buscaDebounced !== params.q) patch({ q: buscaDebounced, page: '' });
  }, [buscaDebounced, params.q, patch]);

  const query = useContatos({
    tipo: aba === 'todos' ? '' : aba,
    busca: params.q || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const confirmarExclusao = async (contato: ContatoDto) => {
    const ok = await confirm({
      titulo: `Excluir ${contato.nome}?`,
      descricao:
        'O contato sai das listas e dos seletores. Lançamentos, contas e notas já vinculados continuam como estão.',
      confirmarTexto: 'Excluir',
      tom: 'destructive',
    });
    if (ok) excluir.mutate(contato.id);
  };

  const colunas: DataTableColumn<ContatoDto>[] = [
    {
      id: 'nome',
      header: 'Nome',
      cell: (c) => (
        <div className="min-w-0">
          <Link
            to={`/contatos/${c.id}`}
            className="font-medium text-texto hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {c.nome}
          </Link>
          {c.documento ? (
            <p className="text-xs text-zinc-500 tabular-nums">{formatDocumento(c.documento)}</p>
          ) : null}
        </div>
      ),
    },
    { id: 'tipo', header: 'Tipo', cell: (c) => <TipoContatoBadge tipo={c.tipo} /> },
    {
      id: 'email',
      header: 'E-mail',
      hideBelow: 'md',
      cell: (c) => <span className="text-zinc-600">{c.email ?? '—'}</span>,
    },
    {
      id: 'telefone',
      header: 'Telefone',
      hideBelow: 'lg',
      cell: (c) => (
        <span className="text-zinc-600 tabular-nums">{formatTelefone(c.telefone) || '—'}</span>
      ),
    },
    {
      id: 'cidade',
      header: 'Cidade',
      hideBelow: 'xl',
      cell: (c) =>
        c.endereco.cidade ? (
          <span className="text-zinc-600">
            {c.endereco.cidade}
            {c.endereco.uf ? `/${c.endereco.uf}` : ''}
          </span>
        ) : (
          '—'
        ),
    },
  ];

  const acoes = (c: ContatoDto) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${c.nome}`}>
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => navigate(`/contatos/${c.id}`)}>
          <Eye /> Ver ficha
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate(`/contatos/${c.id}/editar`)}>
          <Pencil /> Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={() => void confirmarExclusao(c)}>
          <Trash2 /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const vazio = params.q ? (
    <EmptyState
      icone={<Search aria-hidden="true" />}
      titulo="Nenhum contato encontrado"
      descricao={`Nada corresponde a “${params.q}”. Tente outro nome, CPF/CNPJ ou e-mail.`}
      acao={
        <Button variant="outline" onClick={() => setTexto('')} icon={<X aria-hidden="true" />}>
          Limpar busca
        </Button>
      }
    />
  ) : (
    <EmptyState
      icone={<Users aria-hidden="true" />}
      titulo={
        aba === 'cliente'
          ? 'Nenhum cliente cadastrado'
          : aba === 'fornecedor'
            ? 'Nenhum fornecedor cadastrado'
            : 'Nenhum cliente ou fornecedor ainda'
      }
      descricao="Cadastre seus contatos para vincular receitas, despesas, contas e notas fiscais a eles."
      acao={
        <Button asChild icon={<Plus aria-hidden="true" />}>
          <Link to="/contatos/novo">Novo contato</Link>
        </Button>
      }
    />
  );

  const meta = query.data?.meta;

  return (
    <>
      <PageHeader
        titulo="Clientes e fornecedores"
        descricao="Quem compra de você e de quem você compra."
        acoes={
          <Button asChild icon={<Plus aria-hidden="true" />}>
            <Link to="/contatos/novo">Novo contato</Link>
          </Button>
        }
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Tabs
            value={aba}
            onValueChange={(v) => patch({ tipo: v === 'todos' ? '' : v, page: '' })}
          >
            <TabsList aria-label="Filtrar por tipo">
              {ABAS.map((a) => (
                <TabsTrigger key={a.value} value={a.value}>
                  {a.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="w-full md:w-80">
            <Input
              type="search"
              aria-label="Buscar contatos"
              placeholder="Buscar por nome, CPF/CNPJ ou e-mail"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              prefixo={<Search className="size-4" aria-hidden="true" />}
              autoComplete="off"
            />
          </div>
        </div>
      </PageHeader>

      <DataTable
        columns={colunas}
        data={query.data?.data}
        rowKey={(c) => c.id}
        caption="Clientes e fornecedores"
        isLoading={query.isPending}
        isError={query.isError}
        error={query.error}
        onRetry={() => void query.refetch()}
        empty={vazio}
        onRowClick={(c) => navigate(`/contatos/${c.id}`)}
        rowActions={acoes}
        mobileCard={(c) => (
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{c.nome}</span>
              <TipoContatoBadge tipo={c.tipo} />
            </div>
            <p className="mt-0.5 text-sm text-zinc-500">
              {[
                c.documento ? formatDocumento(c.documento) : null,
                formatTelefone(c.telefone) || null,
                c.email,
              ]
                .filter(Boolean)
                .join(' · ') || 'Sem documento, telefone ou e-mail'}
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
    </>
  );
}
