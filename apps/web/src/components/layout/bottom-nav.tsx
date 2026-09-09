import { Ellipsis, LogOut } from 'lucide-react';
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router';

import { navItems } from '@/app/registry';
import { useLogout } from '@/features/auth/hooks';
import { useAuthStore } from '@/features/auth/store';
import { cn } from '@/lib/utils/cn';

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { bottomNavSlots, filtrarPorAdmin, itensMais, rotaAtiva } from './nav';

const itemClass =
  'flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium text-zinc-500 transition-colors [&_svg]:size-5';
const ativoClass = 'text-primary-700';

/** Barra inferior do mobile: 4 atalhos + "Mais" (folha com o restante do menu e "Sair"). */
export function BottomNav() {
  const [maisAberto, setMaisAberto] = useState(false);
  const { pathname } = useLocation();
  const user = useAuthStore((s) => s.user);
  const itensVisiveis = filtrarPorAdmin(navItems, user?.admin ?? false);
  const slots = bottomNavSlots(itensVisiveis);
  const restantes = itensMais(itensVisiveis);
  const logout = useLogout();
  const algumRestanteAtivo = restantes.some((i) => rotaAtiva(i.to, pathname));

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 h-16 border-t border-borda bg-superficie/95 backdrop-blur safe-bottom md:hidden"
      >
        <ul className="flex h-16 items-stretch">
          {slots.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id} className="flex min-w-0 flex-1">
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => cn(itemClass, isActive && ativoClass)}
                >
                  {Icon ? <Icon aria-hidden="true" /> : null}
                  <span className="truncate">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
          <li className="flex min-w-0 flex-1">
            <button
              type="button"
              className={cn(itemClass, algumRestanteAtivo && ativoClass)}
              onClick={() => setMaisAberto(true)}
              aria-haspopup="dialog"
              aria-expanded={maisAberto}
            >
              <Ellipsis aria-hidden="true" />
              <span>Mais</span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={maisAberto} onOpenChange={setMaisAberto}>
        <SheetContent side="bottom" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Mais</SheetTitle>
            <SheetDescription className="sr-only">Outras áreas do sistema</SheetDescription>
          </SheetHeader>
          <ul className="grid grid-cols-3 gap-2">
            {restantes.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <NavLink
                    to={item.to}
                    onClick={() => setMaisAberto(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-lg border border-borda p-3 text-center text-xs font-medium text-zinc-700 [&_svg]:size-6',
                        isActive && 'border-primary-300 bg-primary-50 text-primary-800',
                      )
                    }
                  >
                    {Icon ? <Icon aria-hidden="true" /> : null}
                    {item.label}
                  </NavLink>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                onClick={() => {
                  setMaisAberto(false);
                  logout.mutate();
                }}
                className="flex min-h-20 w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-borda p-3 text-center text-xs font-medium text-zinc-700 [&_svg]:size-6"
              >
                <LogOut aria-hidden="true" />
                Sair
              </button>
            </li>
          </ul>
          {user ? (
            <p className="mt-2 truncate text-center text-xs text-zinc-500">
              {user.nome} · {user.email}
            </p>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
