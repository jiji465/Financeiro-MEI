import { LogOut, PanelLeft } from 'lucide-react';
import { NavLink } from 'react-router';

import { navItems } from '@/app/registry';
import { useLogout } from '@/features/auth/hooks';
import { useAuthStore } from '@/features/auth/store';
import { iniciais } from '@/lib/format/texto';
import { cn } from '@/lib/utils/cn';

import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { BrandMark } from './brand';
import { agruparNav, filtrarNav } from './nav';

export interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

/** Sidebar do desktop (256px; 64px quando recolhida). Oculta abaixo de md. */
export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const user = useAuthStore((s) => s.user);
  const tenant = useAuthStore((s) => s.tenant);
  const logout = useLogout();
  const admin = useAuthStore((s) => s.user?.admin ?? false);
  const interno = useAuthStore((s) => s.tenant?.interno ?? false);
  const grupos = agruparNav(filtrarNav(navItems, { admin, interno }));

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-borda bg-superficie transition-[width] duration-200 md:flex',
        collapsed ? 'w-16' : 'w-64',
      )}
      aria-label="Menu principal"
    >
      <div
        className={cn(
          // h-14 igual à topbar: a linha da marca e a da topbar formam uma régua só no topo.
          'flex h-14 items-center border-b border-borda',
          collapsed ? 'justify-center px-2' : 'px-4',
        )}
      >
        <BrandMark compacto={collapsed} />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {grupos.map((grupo) => (
          <div key={grupo.id} className="mb-3">
            {grupo.label && !collapsed ? (
              <p className="px-3 pb-1.5 text-zinc-400 rotulo">{grupo.label}</p>
            ) : null}
            <ul className="space-y-0.5">
              {grupo.itens.map((item) => {
                const Icon = item.icon;
                const link = (
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      cn(
                        // Item ativo: fundo neutro + texto cheio. O acento aparece só no ícone —
                        // é o suficiente pra marcar "você está aqui" sem pintar o menu inteiro.
                        'group/nav flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-texto',
                        isActive && 'bg-zinc-100 font-semibold text-texto',
                        collapsed && 'justify-center px-0',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {Icon ? (
                          <Icon
                            className={cn(
                              'size-[18px] shrink-0 transition-colors',
                              isActive
                                ? 'text-acento-600'
                                : 'text-zinc-400 group-hover/nav:text-zinc-500',
                            )}
                            aria-hidden="true"
                          />
                        ) : null}
                        {collapsed ? (
                          <span className="sr-only">{item.label}</span>
                        ) : (
                          <span className="truncate">{item.label}</span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
                return (
                  <li key={item.id}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-borda p-2">
        {!collapsed && user ? (
          <div className="mb-1 flex items-center gap-3 px-2 py-2">
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-800"
            >
              {iniciais(user.nome)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{user.nome}</span>
              <span className="block truncate text-xs text-zinc-500">
                {tenant?.interno
                  ? 'Administrador'
                  : tenant?.nomeFantasia || tenant?.nome || user.email}
              </span>
            </span>
          </div>
        ) : null}
        <div
          className={cn(
            'flex gap-1',
            collapsed ? 'flex-col items-center' : 'items-center justify-between',
          )}
        >
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-expanded={!collapsed}
            className="flex size-10 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-texto"
          >
            <PanelLeft className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className={cn(
              'flex h-10 items-center gap-2 rounded-md px-3 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-texto disabled:opacity-50',
              collapsed && 'w-10 justify-center px-0',
            )}
          >
            <LogOut className="size-4" aria-hidden="true" />
            {collapsed ? <span className="sr-only">Sair</span> : 'Sair'}
          </button>
        </div>
      </div>
    </aside>
  );
}
