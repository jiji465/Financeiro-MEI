// /admin/contas/:id — usuários de um MEI, um a um: suspender/reativar, redefinir senha e
// tornar/remover administrador individualmente (não só o titular do tenant — seção 13 do plano).
import type { AdminUsuarioDto } from '@meifin/shared';
import { useState } from 'react';
import { useParams } from 'react-router';

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
import { PageSkeleton } from '@/components/ui/skeleton';
import { QueryState } from '@/components/ui/query-state';
import { formatData } from '@/lib/format/date';
import { ATIVIDADE_LABELS } from '@/lib/labels';

import { SenhaGeradaDialog } from '../components/senha-gerada-dialog';
import { useAdminTenant, useAtualizarUsuarioAdmin, useRedefinirSenha } from '../hooks';
import { RequireAdmin } from '../require-admin';

export function TenantDetalhePage() {
  return (
    <RequireAdmin>
      <TenantDetalheConteudo />
    </RequireAdmin>
  );
}

function TenantDetalheConteudo() {
  const { id = '' } = useParams<{ id: string }>();
  const tenant = useAdminTenant(id);
  const atualizarUsuario = useAtualizarUsuarioAdmin();
  const redefinirSenha = useRedefinirSenha();
  const confirm = useConfirm();
  const [senhaGerada, setSenhaGerada] = useState<{ nome: string; senha: string } | null>(null);

  const suspenderUsuario = async (u: AdminUsuarioDto) => {
    const ok = await confirm({
      titulo: `Suspender ${u.nome}?`,
      descricao: 'Bloqueia o login dela. Pode reativar depois.',
      tom: 'destructive',
      confirmarTexto: 'Suspender',
    });
    if (ok) atualizarUsuario.mutate({ id: u.id, ativo: false });
  };

  const redefinirSenhaDe = async (u: AdminUsuarioDto) => {
    const ok = await confirm({
      titulo: `Redefinir a senha de ${u.nome}?`,
      descricao:
        'Gera uma senha nova e encerra as sessões abertas dela — você vai precisar repassar a nova senha por fora do sistema.',
      confirmarTexto: 'Redefinir senha',
    });
    if (!ok) return;
    redefinirSenha.mutate(u.id, {
      onSuccess: (res) => setSenhaGerada({ nome: u.nome, senha: res.data.senha }),
    });
  };

  const colunas: DataTableColumn<AdminUsuarioDto>[] = [
    { id: 'nome', header: 'Nome', cell: (u) => u.nome },
    { id: 'email', header: 'E-mail', cell: (u) => u.email, hideBelow: 'sm' },
    {
      id: 'status',
      header: 'Status',
      cell: (u) => (
        <Badge tone={u.ativo ? 'receita' : 'neutral'}>{u.ativo ? 'Ativo' : 'Suspenso'}</Badge>
      ),
    },
    {
      id: 'admin',
      header: 'Administrador',
      hideBelow: 'md',
      cell: (u) => (u.admin ? <Badge tone="alerta">Admin</Badge> : '—'),
    },
    {
      id: 'ultimoLogin',
      header: 'Último login',
      hideBelow: 'lg',
      cell: (u) => (u.ultimoLoginAt ? formatData(u.ultimoLoginAt) : '—'),
    },
  ];

  return (
    <QueryState query={tenant} skeleton={<PageSkeleton />}>
      {(t) => (
        <>
          <PageHeader
            titulo={t.nome}
            voltar="/admin?aba=contas"
            descricao={
              <span className="flex flex-wrap items-center gap-2">
                {ATIVIDADE_LABELS[t.atividade]}
                <Badge tone={t.ativo ? 'receita' : 'neutral'}>
                  {t.ativo ? 'Ativo' : 'Suspenso'}
                </Badge>
              </span>
            }
          />
          <DataTable
            columns={colunas}
            data={t.usuarios}
            rowKey={(u) => u.id}
            caption={`Usuários de ${t.nome}`}
            empty={<p className="p-6 text-center text-sm text-zinc-500">Nenhum usuário.</p>}
            mobileCard={(u) => (
              <div>
                <p className="font-medium">{u.nome}</p>
                <p className="text-xs text-zinc-500">{u.email}</p>
              </div>
            )}
            rowActions={(u) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${u.nome}`}>
                    ⋯
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {u.ativo ? (
                    <DropdownMenuItem onSelect={() => void suspenderUsuario(u)}>
                      Suspender
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onSelect={() => atualizarUsuario.mutate({ id: u.id, ativo: true })}
                    >
                      Reativar
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => void redefinirSenhaDe(u)}>
                    Redefinir senha
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => atualizarUsuario.mutate({ id: u.id, admin: !u.admin })}
                  >
                    {u.admin ? 'Remover acesso de administrador' : 'Tornar administrador'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          />
          <SenhaGeradaDialog dados={senhaGerada} onClose={() => setSenhaGerada(null)} />
        </>
      )}
    </QueryState>
  );
}
