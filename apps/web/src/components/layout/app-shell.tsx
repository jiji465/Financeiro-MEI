// Shell autenticado: sidebar (desktop) / barra inferior + FAB (mobile), topbar e área de conteúdo.
import { Suspense, useState } from 'react';
import { Outlet } from 'react-router';

import { TrocarSenhaObrigatoria } from '@/features/auth/components/trocar-senha-obrigatoria';
import { useAuthStore } from '@/features/auth/store';

import { OfflineBanner } from '../ui/offline-banner';
import { PageSkeleton } from '../ui/skeleton';
import { BottomNav } from './bottom-nav';
import { Fab } from './fab';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

const CHAVE_SIDEBAR = 'meifin.sidebar.recolhida';

function lerRecolhida(): boolean {
  try {
    return localStorage.getItem(CHAVE_SIDEBAR) === '1';
  } catch {
    return false;
  }
}

export function AppShell() {
  const [recolhida, setRecolhida] = useState(lerRecolhida);
  const deveTrocarSenha = useAuthStore((s) => s.user?.deveTrocarSenha ?? false);

  const alternar = () => {
    setRecolhida((atual) => {
      const proximo = !atual;
      try {
        localStorage.setItem(CHAVE_SIDEBAR, proximo ? '1' : '0');
      } catch {
        // armazenamento indisponível (modo privado) — ignora
      }
      return proximo;
    });
  };

  if (deveTrocarSenha) return <TrocarSenhaObrigatoria />;

  return (
    <div className="flex min-h-dvh">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-superficie focus:px-3 focus:py-2 focus:shadow-lg"
      >
        Ir para o conteúdo
      </a>
      <Sidebar collapsed={recolhida} onToggle={alternar} />
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <Topbar />
        <main
          id="conteudo"
          className="mx-auto w-full max-w-7xl flex-1 px-4 pt-4 pb-28 md:px-6 md:pt-6 md:pb-10"
        >
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
        <BottomNav />
        <Fab />
      </div>
    </div>
  );
}
