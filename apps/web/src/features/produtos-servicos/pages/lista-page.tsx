// /produtos-servicos — o catálogo do MEI: o que ele vende e o que ele presta. Abas Produtos /
// Serviços / Todos (?tipo), busca (?q) e o diálogo de cadastro aberto pela URL (?novo=produto),
// que é o que os atalhos [+] da barra do topo usam.
//
// Cadastrar aqui não é obrigatório para lançar dinheiro: serve para quem quer detalhar a venda
// em itens (3 bolos + 2 tortas) e ter o preço sugerido na hora de lançar.
import type { ProdutoServicoDto, TipoProdutoServico } from '@meifin/shared';
import { MoreHorizontal, Package, Pencil, Plus, Power, Search, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

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
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatBRL } from '@/lib/format/money';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { useSearchParamsObject } from '@/lib/hooks/use-search-params-state';
import { TIPO_PRODUTO_SERVICO_LABELS } from '@/lib/labels';

import { ProdutoServicoDialog } from '../components/produto-servico-dialog';
import {
  useAtualizarProdutoServico,
  useExcluirProdutoServico,
  useProdutosServicos,
} from '../hooks';

const ABAS: { value: TipoProdutoServico | 'todos'; label: string }[] = [
  { value: 'produto', label: 'Produtos' },
  { value: 'servico', label: 'Serviços' },
  { value: 'todos', label: 'Todos' },
];

function abaValida(valor: string): TipoProdutoServico | 'todos' {
  return valor === 'produto' || valor === 'servico' ? valor : 'todos';
}

function tipoNovo(valor: string): TipoProdutoServico {
  return valor === 'servico' ? 'servico' : 'produto';
}

/** Botão de ativar/desativar de uma linha — precisa do id para montar a mutation. */
function ItemAcoes({
  item,
  onEditar,
  onExcluir,
}: {
  item: ProdutoServicoDto;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  const atualizar = useAtualizarProdutoServico(item.id);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${item.nome}`}>
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEditar}>
          <Pencil /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => atualizar.mutate({ ativo: !item.ativo })}>
          <Power /> {item.ativo ? 'Desativar' : 'Reativar'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={onExcluir}>
          <Trash2 /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ProdutosServicosListaPage() {
  const confirm = useConfirm();
  const excluir = useExcluirProdutoServico();
  const [params, patch] = useSearchParamsObject(['tipo', 'q', 'novo']);
  const aba = abaValida(params.tipo);

  const [texto, setTexto] = useState(params.q);
  const buscaDebounced = useDebounce(texto.trim(), 300);
  useEffect(() => {
    if (buscaDebounced !== params.q) patch({ q: buscaDebounced });
  }, [buscaDebounced, params.q, patch]);

  const [editando, setEditando] = useState<ProdutoServicoDto | null>(null);
  const criando = Boolean(params.novo);
  const dialogoAberto = criando || editando !== null;

  const query = useProdutosServicos({
    ...(aba === 'todos' ? {} : { tipo: aba }),
    ...(params.q ? { busca: params.q } : {}),
  });
  const itens = query.data;

  const abrirNovo = (tipo: TipoProdutoServico) => {
    setEditando(null);
    patch({ novo: tipo });
  };

  const fecharDialogo = () => {
    setEditando(null);
    if (params.novo) patch({ novo: '' });
  };

  const confirmarExclusao = async (item: ProdutoServicoDto) => {
    const ok = await confirm({
      titulo: `Excluir "${item.nome}"?`,
      descricao:
        item.lancamentos > 0
          ? `O item sai do catálogo e dos seletores. Os ${item.lancamentos} lançamento(s) que já o usaram continuam mostrando o que foi vendido, com os mesmos valores.`
          : 'O item sai do catálogo e dos seletores.',
      confirmarTexto: 'Excluir',
      tom: 'destructive',
    });
    if (ok) excluir.mutate(item.id);
  };

  const colunas: DataTableColumn<ProdutoServicoDto>[] = [
    {
      id: 'nome',
      header: 'Item',
      cell: (p) => (
        <div className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-texto">{p.nome}</span>
            {!p.ativo ? (
              <Badge tone="neutral" className="font-normal">
                Inativo
              </Badge>
            ) : null}
          </span>
          {p.descricao ? <p className="truncate text-xs text-zinc-500">{p.descricao}</p> : null}
        </div>
      ),
    },
    {
      id: 'tipo',
      header: 'Tipo',
      cell: (p) => (
        <Badge tone={p.tipo === 'produto' ? 'info' : 'neutral'} className="font-normal">
          {TIPO_PRODUTO_SERVICO_LABELS[p.tipo]}
        </Badge>
      ),
    },
    {
      id: 'unidade',
      header: 'Unidade',
      hideBelow: 'lg',
      cell: (p) => <span className="text-zinc-600">{p.unidade ?? '—'}</span>,
    },
    {
      id: 'precoPadrao',
      header: 'Preço padrão',
      numeric: true,
      cell: (p) => (
        <span className="text-zinc-700 tabular-nums">
          {p.precoPadrao === null ? 'A combinar' : formatBRL(p.precoPadrao)}
        </span>
      ),
    },
    {
      id: 'lancamentos',
      header: 'Lançamentos',
      numeric: true,
      hideBelow: 'md',
      cell: (p) => <span className="text-zinc-600 tabular-nums">{p.lancamentos}</span>,
    },
  ];

  const vazio = params.q ? (
    <EmptyState
      icone={<Search aria-hidden="true" />}
      titulo="Nenhum item encontrado"
      descricao={`Nada corresponde a “${params.q}”. Tente outro nome.`}
      acao={
        <Button variant="outline" onClick={() => setTexto('')} icon={<X aria-hidden="true" />}>
          Limpar busca
        </Button>
      }
    />
  ) : (
    <EmptyState
      icone={<Package aria-hidden="true" />}
      titulo={
        aba === 'servico'
          ? 'Nenhum serviço cadastrado'
          : aba === 'produto'
            ? 'Nenhum produto cadastrado'
            : 'Catálogo vazio'
      }
      descricao="Cadastre o que você vende e o que você presta para detalhar as vendas em itens (3 bolos + 2 tortas) e já ter o preço sugerido na hora de lançar."
      acao={
        <div className="flex flex-wrap justify-center gap-2">
          <Button icon={<Plus aria-hidden="true" />} onClick={() => abrirNovo('produto')}>
            Novo produto
          </Button>
          <Button
            variant="outline"
            icon={<Plus aria-hidden="true" />}
            onClick={() => abrirNovo('servico')}
          >
            Novo serviço
          </Button>
        </div>
      }
    />
  );

  return (
    <>
      <PageHeader
        titulo="Produtos e serviços"
        descricao="O catálogo do seu negócio: o que você vende e o que você presta."
        acoes={
          <div className="flex flex-wrap gap-2">
            <Button icon={<Plus aria-hidden="true" />} onClick={() => abrirNovo('produto')}>
              Novo produto
            </Button>
            <Button
              variant="outline"
              icon={<Plus aria-hidden="true" />}
              onClick={() => abrirNovo('servico')}
            >
              Novo serviço
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Tabs value={aba} onValueChange={(v) => patch({ tipo: v === 'todos' ? '' : v })}>
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
              aria-label="Buscar no catálogo"
              placeholder="Buscar por nome"
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
        data={itens}
        rowKey={(p) => p.id}
        caption="Produtos e serviços"
        isLoading={query.isPending}
        isError={query.isError}
        error={query.error}
        onRetry={() => void query.refetch()}
        onRowClick={(p) => setEditando(p)}
        rowActions={(p) => (
          <ItemAcoes
            item={p}
            onEditar={() => setEditando(p)}
            onExcluir={() => void confirmarExclusao(p)}
          />
        )}
        empty={vazio}
        mobileCard={(p) => (
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{p.nome}</span>
              <span className="shrink-0 text-zinc-700 tabular-nums">
                {p.precoPadrao === null ? 'A combinar' : formatBRL(p.precoPadrao)}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">
              {[TIPO_PRODUTO_SERVICO_LABELS[p.tipo], p.unidade].filter(Boolean).join(' · ')}
              {!p.ativo ? ' · Inativo' : ''}
            </p>
          </div>
        )}
        contorno
      />

      <ProdutoServicoDialog
        item={editando ?? undefined}
        tipoInicial={tipoNovo(params.novo)}
        aberto={dialogoAberto}
        onOpenChange={(open) => !open && fecharDialogo()}
      />
    </>
  );
}
