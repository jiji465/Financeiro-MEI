// Lista de categorias (receita/despesa) com criação, edição e exclusão (a API desativa em vez de
// excluir quando há lançamentos vinculados; a de sistema, "Impostos e DAS", não pode ser excluída).
import type { CategoriaDto, TipoLancamento } from '@meifin/shared';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { GRUPO_DASN_LABELS } from '@/lib/labels';

import { useCategoriasConfig, useExcluirCategoria } from '../hooks';
import { CategoriaDialog } from './categoria-dialog';

function PontoCor({ cor }: { cor: string | null }) {
  return (
    <span
      className="inline-block size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: cor ?? '#a1a1aa' }}
      aria-hidden="true"
    />
  );
}

function ListaDoTipo({ tipo }: { tipo: TipoLancamento }) {
  const query = useCategoriasConfig(tipo);
  const excluir = useExcluirCategoria();
  const confirm = useConfirm();
  const [dialogo, setDialogo] = useState<{ categoria: CategoriaDto | null } | null>(null);

  const aoExcluir = async (categoria: CategoriaDto) => {
    const ok = await confirm({
      titulo: `Excluir "${categoria.nome}"?`,
      descricao:
        'Se houver lançamentos usando essa categoria, ela será desativada em vez de excluída (continua aparecendo no histórico, mas some das opções de novos lançamentos).',
      confirmarTexto: 'Excluir',
      tom: 'destructive',
    });
    if (!ok) return;
    try {
      const res = await excluir.mutateAsync(categoria.id);
      toast.info(
        res.data.desativada
          ? `"${categoria.nome}" tinha lançamentos vinculados e foi desativada.`
          : `"${categoria.nome}" foi excluída.`,
      );
    } catch {
      // erro já vira toast pelo QueryClient (meta padrão)
    }
  };

  const columns: DataTableColumn<CategoriaDto>[] = [
    {
      id: 'nome',
      header: 'Nome',
      cell: (c) => (
        <span className="flex items-center gap-2 font-medium">
          <PontoCor cor={c.cor} />
          {c.nome}
          {!c.ativo ? (
            <Badge tone="neutral" className="font-normal">
              Inativa
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      id: 'grupo',
      header: 'Grupo DASN',
      hideBelow: 'sm',
      cell: (c) =>
        c.grupoDasn ? (
          <span className="text-zinc-600">{GRUPO_DASN_LABELS[c.grupoDasn]}</span>
        ) : c.tipo === 'receita' ? (
          <span className="text-alerta-600">Sem grupo</span>
        ) : (
          <span className="text-zinc-400">—</span>
        ),
    },
    {
      id: 'tags',
      header: '',
      hideBelow: 'md',
      cell: (c) => (
        <div className="flex flex-wrap justify-end gap-1">
          {c.sistema ? <Badge tone="primary">Sistema</Badge> : null}
          {c.padrao ? <Badge tone="outline">Padrão</Badge> : null}
        </div>
      ),
    },
  ];

  const acoes = (c: CategoriaDto) => (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Editar ${c.nome}`}
        onClick={() => setDialogo({ categoria: c })}
      >
        <Pencil aria-hidden="true" />
      </Button>
      {c.sistema ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled
                aria-label={`${c.nome} não pode ser excluída`}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Categoria de sistema, não pode ser excluída</TooltipContent>
        </Tooltip>
      ) : (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Excluir ${c.nome}`}
          className="text-despesa-700 hover:bg-despesa-50"
          loading={excluir.isPending && excluir.variables === c.id}
          onClick={() => void aoExcluir(c)}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          icon={<Plus aria-hidden="true" />}
          onClick={() => setDialogo({ categoria: null })}
        >
          Nova categoria
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={query.data}
        rowKey={(c) => c.id}
        isLoading={query.isPending}
        isError={query.isError}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowActions={acoes}
        caption={`Categorias de ${tipo === 'receita' ? 'receita' : 'despesa'}`}
        empty={
          <EmptyState
            titulo="Nenhuma categoria"
            descricao="Crie a primeira categoria para organizar seus lançamentos."
            acao={
              <Button size="sm" onClick={() => setDialogo({ categoria: null })}>
                Nova categoria
              </Button>
            }
          />
        }
      />
      <CategoriaDialog
        categoria={dialogo?.categoria}
        tipoPadrao={tipo}
        aberto={dialogo !== null}
        onOpenChange={(open) => !open && setDialogo(null)}
      />
    </div>
  );
}

export function CategoriasLista() {
  const [tipo, setTipo] = useState<TipoLancamento>('despesa');
  return (
    <Tabs value={tipo} onValueChange={(v) => setTipo(v as TipoLancamento)}>
      <TabsList>
        <TabsTrigger value="despesa">Despesas</TabsTrigger>
        <TabsTrigger value="receita">Receitas</TabsTrigger>
      </TabsList>
      <TabsContent value="despesa">
        <ListaDoTipo tipo="despesa" />
      </TabsContent>
      <TabsContent value="receita">
        <ListaDoTipo tipo="receita" />
      </TabsContent>
    </Tabs>
  );
}
