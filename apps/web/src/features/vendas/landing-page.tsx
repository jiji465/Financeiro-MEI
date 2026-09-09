// Página de vendas pública: o que aparece em "/" para quem não está logado (seção 11 do plano).
// Quem está logado nunca vê esta página — RequireAuth mostra o AppShell/dashboard normalmente.
import { BarChart3, Landmark, Receipt, ShieldCheck, Users, Wallet } from 'lucide-react';
import { Link } from 'react-router';

import { BrandMark } from '@/components/layout/brand';
import { Button } from '@/components/ui/button';

const RECURSOS = [
  {
    icone: Wallet,
    titulo: 'Lançamentos e fluxo de caixa',
    descricao: 'Registre receitas e despesas, com recorrência, anexos e conciliação por CSV.',
  },
  {
    icone: Landmark,
    titulo: 'DAS e limite do MEI',
    descricao: 'Calendário do DAS mensal, DASN-SIMEI e alertas do limite anual de faturamento.',
  },
  {
    icone: Receipt,
    titulo: 'Notas e contas',
    descricao: 'Contas a pagar e receber com parcelamento, e registro de notas fiscais emitidas.',
  },
  {
    icone: Users,
    titulo: 'Clientes e fornecedores',
    descricao: 'Um cadastro só, com histórico de lançamentos por cliente ou fornecedor.',
  },
  {
    icone: BarChart3,
    titulo: 'Relatórios',
    descricao: 'DRE simplificada, extrato e faturamento, exportados em CSV ou PDF.',
  },
  {
    icone: ShieldCheck,
    titulo: 'Acesso controlado',
    descricao: 'Cada conta é criada e acompanhada por nós — nada de cadastro aberto.',
  },
] as const;

export function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-fundo">
      <header className="flex h-16 items-center justify-between px-4 md:px-8">
        <BrandMark />
        <Button asChild variant="ghost">
          <Link to="/entrar">Já tenho conta</Link>
        </Button>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 py-12 text-center md:py-20">
          <h1 className="text-3xl font-bold tracking-tight text-texto md:text-5xl">
            O financeiro do seu MEI, organizado em um só lugar
          </h1>
          <p className="mt-4 text-base text-zinc-600 md:text-lg">
            Lançamentos, DAS, limite anual e relatórios — pensado para quem abre um MEI e quer saber
            exatamente quanto entra, quanto sai e o que falta pagar.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link to="/cadastro">Solicitar acesso</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/entrar">Já tenho conta</Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            O acesso não é aberto: você preenche seus dados e entramos em contato para liberar sua
            conta.
          </p>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-16 md:pb-24">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {RECURSOS.map(({ icone: Icone, titulo, descricao }) => (
              <div
                key={titulo}
                className="rounded-xl border border-borda bg-superficie p-5 shadow-card"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                  <Icone className="size-5" aria-hidden="true" />
                </div>
                <h2 className="mt-3 text-sm font-semibold text-texto">{titulo}</h2>
                <p className="mt-1 text-sm text-zinc-600">{descricao}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="px-4 py-6 text-center text-xs text-zinc-500">
        MEI Financeiro · controle financeiro para Microempreendedores Individuais
      </footer>
    </div>
  );
}
