import { ChevronDown, LogOut, Plus, Settings, TrendingDown, TrendingUp } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';

import { navItems } from '@/app/registry';
import { useLogout } from '@/features/auth/hooks';
import { useAuthStore } from '@/features/auth/store';
import { iniciais } from '@/lib/format/texto';

import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { BrandMark } from './brand';
import { itemDaRota } from './nav';

/** Barra superior: título da área (desktop), "Novo lançamento" e menu do usuário. */
export function Topbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const tenant = useAuthStore((s) => s.tenant);
  const logout = useLogout();
  const atual = itemDaRota(pathname);
  const temConfiguracoes = navItems.some((i) => i.to === '/configuracoes');

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-borda bg-superficie/95 px-4 backdrop-blur md:h-16 md:px-6">
      <div className="md:hidden">
        <BrandMark />
      </div>
      <p
        className="hidden min-w-0 truncate text-sm font-medium text-zinc-500 md:block"
        aria-live="polite"
      >
        {atual?.label ?? 'MEI Financeiro'}
      </p>

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="hidden md:inline-flex" icon={<Plus aria-hidden="true" />}>
              Novo lançamento
              <ChevronDown className="-mr-1 opacity-70" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => navigate('/lancamentos?novo=receita')}>
              <TrendingUp className="text-receita-600!" />
              Nova receita
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('/lancamentos?novo=despesa')}>
              <TrendingDown className="text-despesa-600!" />
              Nova despesa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-10 items-center gap-2 rounded-full pr-1 pl-1 hover:bg-zinc-100 md:pr-3"
              aria-label="Menu do usuário"
            >
              <span
                aria-hidden="true"
                className="flex size-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-800"
              >
                {iniciais(user?.nome)}
              </span>
              <span className="hidden max-w-32 truncate text-sm font-medium md:block">
                {user?.nome ?? ''}
              </span>
              <ChevronDown className="hidden size-4 text-zinc-500 md:block" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="text-sm text-texto">
              <span className="block truncate font-medium">{user?.nome}</span>
              <span className="block truncate text-xs font-normal text-zinc-500">
                {user?.email}
              </span>
              {tenant ? (
                <span className="block truncate text-xs font-normal text-zinc-500">
                  {tenant.nomeFantasia || tenant.nome}
                </span>
              ) : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {temConfiguracoes ? (
              <DropdownMenuItem asChild>
                <Link to="/configuracoes">
                  <Settings />
                  Configurações
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={() => logout.mutate()} disabled={logout.isPending}>
              <LogOut />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
