import { ChevronDown, LogOut, Plus, Settings } from 'lucide-react';
import { Fragment } from 'react';
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
import { GRUPOS_NOVO } from './acoes-novo';
import { BrandMark } from './brand';
import { itemDaRota } from './nav';

const TONE_ICONE: Record<string, string> = {
  receita: 'text-receita-600!',
  despesa: 'text-despesa-600!',
};

/**
 * Barra superior: título da área (desktop), o menu "Novo" e o menu do usuário.
 *
 * O menu "Novo" começou como "Novo lançamento" (só receita/despesa). Com o catálogo, ele passou a
 * abrigar também "Novo produto" e "Novo serviço" — daí o rótulo curto: um menu chamado "Novo
 * lançamento" com "Novo produto" dentro seria mentira. Lançamentos continuam em cima, que é o que
 * o dono faz todo dia; o catálogo vem depois, separado.
 */
export function Topbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const tenant = useAuthStore((s) => s.tenant);
  const logout = useLogout();
  const atual = itemDaRota(pathname);
  const interno = tenant?.interno ?? false;
  const temConfiguracoes = !interno && navItems.some((i) => i.to === '/configuracoes');

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-borda bg-superficie/85 px-4 backdrop-blur-md md:h-14 md:px-8">
      <div className="md:hidden">
        <BrandMark />
      </div>
      <p
        className="hidden min-w-0 truncate text-sm font-medium text-zinc-600 md:block"
        aria-live="polite"
      >
        {atual?.label ?? 'MEI Financeiro'}
      </p>

      <div className="ml-auto flex items-center gap-2">
        {interno ? null : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="hidden md:inline-flex" icon={<Plus aria-hidden="true" />}>
                Novo
                <ChevronDown className="-mr-1 opacity-70" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {GRUPOS_NOVO.map((grupo, i) => (
                <Fragment key={grupo.label ?? 'lancamentos'}>
                  {i > 0 ? <DropdownMenuSeparator /> : null}
                  {grupo.label ? (
                    <DropdownMenuLabel className="text-xs font-normal text-zinc-500">
                      {grupo.label}
                    </DropdownMenuLabel>
                  ) : null}
                  {grupo.acoes.map((acao) => (
                    <DropdownMenuItem key={acao.id} onSelect={() => navigate(acao.to)}>
                      <acao.icone className={acao.tone ? TONE_ICONE[acao.tone] : undefined} />
                      {acao.label}
                    </DropdownMenuItem>
                  ))}
                </Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

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
              {tenant && !interno ? (
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
