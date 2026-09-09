// Layout das páginas públicas (entrar, cadastro, esqueci/redefinir senha).
import { Suspense } from 'react';
import { Outlet } from 'react-router';

import { OfflineBanner } from '../ui/offline-banner';
import { Skeleton } from '../ui/skeleton';
import { BrandMark } from './brand';

function FormSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Carregando">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}

export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-fundo">
      <OfflineBanner />
      <header className="flex h-16 items-center px-4 md:px-8">
        <BrandMark />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-4 md:items-center md:py-8">
        <div className="w-full max-w-md rounded-xl border border-borda bg-superficie p-5 shadow-card md:p-8">
          <Suspense fallback={<FormSkeleton />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      <footer className="px-4 py-4 text-center text-xs text-zinc-500">
        MEI Financeiro · controle financeiro para Microempreendedores Individuais
      </footer>
    </div>
  );
}
