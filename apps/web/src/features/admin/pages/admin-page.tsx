// Painel de administrador (seção 11 do plano): resumo, pedidos de acesso e contas. Escopo
// deliberadamente limitado a dados de conta — nunca lançamentos, saldo ou faturamento de tenant.
import type { AdminTenantDto, SolicitacaoDto, StatusSolicitacao } from '@meifin/shared';
import { LABEL_STATUS_SOLICITACAO } from '@meifin/shared';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/ui/page-header';
import { SimpleSelect } from '@/components/ui/select';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatData } from '@/lib/format/date';
import { ATIVIDADE_LABELS } from '@/lib/labels';

import { CriarAdministradorDialog } from '../components/criar-administrador-dialog';
import { CriarContaDialog } from '../components/criar-conta-dialog';
import { RequireAdmin } from '../require-admin';
import {
  useAdminSolicitacoes,
  useAdminTenants,
  useAtualizarSolicitacao,
  useAtualizarTenant,
  useAtualizarUsuarioAdmin,
  useResumoPlataforma,
} from '../hooks';

function ResumoTab() {
  const { data, isLoading } = useResumoPlataforma();
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <StatCard titulo="MEIs cadastrados" valor={data?.totalTenants ?? '—'} loading={isLoading} />
      <StatCard titulo="Usuários" valor={data?.totalUsuarios ?? '—'} loading={isLoading} />
      <StatCard
        titulo="Ativos"
        valor={data?.tenantsAtivos ?? '—'}
        tone="receita"
        loading={isLoading}
      />
      <StatCard
        titulo="Suspensos"
        valor={data?.tenantsSuspensos ?? '—'}
        tone={data && data.tenantsSuspensos > 0 ? 'despesa' : 'neutral'}
        loading={isLoading}
      />
      <StatCard
        titulo="Cadastros nos últimos 30 dias"
        valor={data?.cadastrosUltimos30Dias ?? '—'}
        loading={isLoading}
      />
      <StatCard
        titulo="Pedidos de acesso pendentes"
        valor={data?.solicitacoesPendentes ?? '—'}
        tone={data && data.solicitacoesPendentes > 0 ? 'alerta' : 'neutral'}
        loading={isLoading}
      />
    </div>
  );
}

function SolicitacoesTab({ onCriarConta }: { onCriarConta: (s: SolicitacaoDto) => void }) {
  const [status, setStatus] = useState<StatusSolicitacao | ''>('pendente');
  const { data, isLoading, isError, error, refetch } = useAdminSolicitacoes({
    status: status || undefined,
    pageSize: 100,
  });
  const atualizar = useAtualizarSolicitacao();
  const confirm = useConfirm();

  const recusar = async (s: SolicitacaoDto) => {
    const ok = await confirm({
      titulo: `Recusar o pedido de ${s.nome}?`,
      descricao: 'O pedido fica marcado como recusado; a pessoa não é notificada pelo sistema.',
    });
    if (ok) atualizar.mutate({ id: s.id, status: 'recusada' });
  };

  const colunas: DataTableColumn<SolicitacaoDto>[] = [
    { id: 'nome', header: 'Nome', cell: (s) => s.nome },
    { id: 'email', header: 'E-mail', cell: (s) => s.email, hideBelow: 'sm' },
    {
      id: 'atividade',
      header: 'Atividade',
      cell: (s) => (s.atividade ? ATIVIDADE_LABELS[s.atividade] : '—'),
      hideBelow: 'md',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (s) => (
        <Badge
          tone={
            s.status === 'pendente' ? 'alerta' : s.status === 'aprovada' ? 'receita' : 'neutral'
          }
        >
          {LABEL_STATUS_SOLICITACAO[s.status]}
        </Badge>
      ),
    },
    { id: 'data', header: 'Pedido em', cell: (s) => formatData(s.createdAt), hideBelow: 'lg' },
  ];

  return (
    <div className="space-y-3">
      <SimpleSelect
        value={status}
        onValueChange={(v) => setStatus(v as StatusSolicitacao | '')}
        options={[
          { value: 'pendente', label: 'Pendentes' },
          { value: 'aprovada', label: 'Aprovados' },
          { value: 'recusada', label: 'Recusados' },
        ]}
        opcaoVazia="Todos"
        aria-label="Filtrar por status"
      />
      <DataTable
        columns={colunas}
        data={data?.data}
        rowKey={(s) => s.id}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => void refetch()}
        empty={<p className="p-6 text-center text-sm text-zinc-500">Nenhum pedido por aqui.</p>}
        mobileCard={(s) => (
          <div>
            <p className="font-medium">{s.nome}</p>
            <p className="text-xs text-zinc-500">{s.email}</p>
          </div>
        )}
        rowActions={(s) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Ações do pedido de ${s.nome}`}>
                ⋯
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {s.status === 'pendente' ? (
                <>
                  <DropdownMenuItem onSelect={() => onCriarConta(s)}>Criar conta</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void recusar(s)}>Recusar</DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onSelect={() => onCriarConta(s)}>Criar conta</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
    </div>
  );
}

function ContasTab({
  onNovaConta,
  onNovoAdministrador,
}: {
  onNovaConta: () => void;
  onNovoAdministrador: () => void;
}) {
  const [busca, setBusca] = useState('');
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useAdminTenants({
    busca: busca || undefined,
    pageSize: 100,
  });
  const atualizarTenant = useAtualizarTenant();
  const atualizarUsuario = useAtualizarUsuarioAdmin();
  const confirm = useConfirm();

  const suspender = async (t: AdminTenantDto) => {
    const ok = await confirm({
      titulo: `Suspender ${t.nome}?`,
      descricao: 'Bloqueia o login de todos os usuários dessa conta. Pode reativar depois.',
      tom: 'destructive',
      confirmarTexto: 'Suspender',
    });
    if (ok) atualizarTenant.mutate({ id: t.id, ativo: false });
  };

  const colunas: DataTableColumn<AdminTenantDto>[] = [
    { id: 'nome', header: 'MEI', cell: (t) => t.nome },
    { id: 'email', header: 'Titular', cell: (t) => t.emailTitular ?? '—', hideBelow: 'sm' },
    {
      id: 'atividade',
      header: 'Atividade',
      cell: (t) => ATIVIDADE_LABELS[t.atividade],
      hideBelow: 'md',
    },
    {
      id: 'usuarios',
      header: 'Usuários',
      cell: (t) => t.totalUsuarios,
      hideBelow: 'lg',
      numeric: true,
    },
    { id: 'cadastro', header: 'Cadastro', cell: (t) => formatData(t.createdAt), hideBelow: 'lg' },
    {
      id: 'status',
      header: 'Status',
      cell: (t) => (
        <Badge tone={t.ativo ? 'receita' : 'neutral'}>{t.ativo ? 'Ativo' : 'Suspenso'}</Badge>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou e-mail"
          aria-label="Buscar MEI"
          className="h-10 w-full rounded-md border border-borda bg-superficie px-3 text-sm sm:max-w-xs"
        />
        <div className="flex gap-2">
          <Button variant="outline" onClick={onNovoAdministrador}>
            Novo administrador
          </Button>
          <Button onClick={onNovaConta}>Nova conta</Button>
        </div>
      </div>
      <DataTable
        columns={colunas}
        data={data?.data}
        rowKey={(t) => t.id}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => void refetch()}
        onRowClick={(t) => navigate(`/admin/contas/${t.id}`)}
        empty={
          <p className="p-6 text-center text-sm text-zinc-500">Nenhum MEI cadastrado ainda.</p>
        }
        mobileCard={(t) => (
          <div>
            <p className="font-medium">{t.nome}</p>
            <p className="text-xs text-zinc-500">{t.emailTitular}</p>
          </div>
        )}
        rowActions={(t) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${t.nome}`}>
                ⋯
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {t.ativo ? (
                <DropdownMenuItem onSelect={() => void suspender(t)}>Suspender</DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onSelect={() => atualizarTenant.mutate({ id: t.id, ativo: true })}
                >
                  Reativar
                </DropdownMenuItem>
              )}
              {t.titularId ? (
                <DropdownMenuItem
                  onSelect={() =>
                    atualizarUsuario.mutate({ id: t.titularId!, admin: !t.titularEhAdmin })
                  }
                >
                  {t.titularEhAdmin ? 'Remover acesso de administrador' : 'Tornar administrador'}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
    </div>
  );
}

export function AdminPage() {
  return (
    <RequireAdmin>
      <AdminPageConteudo />
    </RequireAdmin>
  );
}

function AdminPageConteudo() {
  const [params, setParams] = useSearchParams();
  const aba = params.get('aba') ?? 'resumo';
  const [dialogo, setDialogo] = useState<{ solicitacao?: SolicitacaoDto } | null>(null);
  const [dialogoAdminAberto, setDialogoAdminAberto] = useState(false);

  return (
    <div>
      <PageHeader
        titulo="Administração"
        descricao="Contas, pedidos de acesso e números da plataforma."
      />
      <Tabs value={aba} onValueChange={(v) => setParams({ aba: v })}>
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="solicitacoes">Pedidos de acesso</TabsTrigger>
          <TabsTrigger value="contas">Contas</TabsTrigger>
        </TabsList>
        <TabsContent value="resumo">
          <ResumoTab />
        </TabsContent>
        <TabsContent value="solicitacoes">
          <SolicitacoesTab onCriarConta={(s) => setDialogo({ solicitacao: s })} />
        </TabsContent>
        <TabsContent value="contas">
          <ContasTab
            onNovaConta={() => setDialogo({})}
            onNovoAdministrador={() => setDialogoAdminAberto(true)}
          />
        </TabsContent>
      </Tabs>

      <CriarAdministradorDialog open={dialogoAdminAberto} onOpenChange={setDialogoAdminAberto} />

      <CriarContaDialog
        key={dialogo?.solicitacao?.id ?? 'nova'}
        open={dialogo !== null}
        onOpenChange={(open) => setDialogo(open ? dialogo : null)}
        prefill={
          dialogo?.solicitacao
            ? {
                solicitacaoId: dialogo.solicitacao.id,
                nome: dialogo.solicitacao.nome,
                email: dialogo.solicitacao.email,
                atividade: dialogo.solicitacao.atividade ?? undefined,
              }
            : undefined
        }
      />
    </div>
  );
}
