// Página de vendas pública: o que aparece em "/" para quem não está logado (seção 11 do plano).
// Quem está logado nunca vê esta página — RequireAuth mostra o AppShell/dashboard normalmente.
import {
  BarChart3,
  Landmark,
  MessageCircle,
  Receipt,
  ShieldCheck,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router';

import { BrandMark } from '@/components/layout/brand';
import { Button } from '@/components/ui/button';

import { HeroZoom } from './components/hero-zoom';
import { ContasPreview, DasPreview, RelatorioPreview, SeloCheck } from './components/previews';
import { Reveal } from './components/reveal';
import { VitrineSecao } from './components/vitrine-secao';

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

const CONFIANCA = [
  'Cálculo automático do DAS',
  'Relatórios em PDF, CSV e XLSX',
  'Alertas do limite anual de faturamento',
  'Pensado pra quem não é contador',
];

const PASSOS_ACESSO = [
  {
    numero: '1',
    icone: MessageCircle,
    titulo: 'Solicitar acesso',
    descricao:
      'Preencha seus dados em menos de um minuto — nome, e-mail e um pouco do seu negócio.',
  },
  {
    numero: '2',
    icone: UserCheck,
    titulo: 'Conversamos com você',
    descricao: 'Entramos em contato pra confirmar os detalhes do seu MEI antes de liberar a conta.',
  },
  {
    numero: '3',
    icone: ShieldCheck,
    titulo: 'Conta liberada',
    descricao: 'Você recebe o acesso e já pode começar a organizar o financeiro do seu MEI.',
  },
] as const;

export function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-fundo">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between px-4 md:px-8">
        <BrandMark />
        <Button asChild variant="ghost">
          <Link to="/entrar">Já tenho conta</Link>
        </Button>
      </header>

      <main className="flex-1">
        <HeroZoom />

        {/* Faixa de confiança */}
        <Reveal>
          <section className="border-y border-borda bg-superficie px-4 py-6 md:px-8">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 md:justify-between">
              {CONFIANCA.map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-zinc-600">
                  <SeloCheck />
                  {item}
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        {/* Vitrine de recursos (alternada) */}
        <section className="mx-auto max-w-6xl space-y-20 px-4 py-16 md:space-y-28 md:py-24">
          <Reveal>
            <VitrineSecao
              titulo="Nunca mais perca a data do DAS"
              bullets={[
                'Calendário com todas as competências do ano',
                'Alertas antes do vencimento',
                'Marque como pago em um clique',
              ]}
              preview={<DasPreview />}
            />
          </Reveal>
          <Reveal>
            <VitrineSecao
              titulo="Contas a pagar e receber, sem planilha"
              bullets={[
                'Parcelamento automático',
                'Veja o que está vencido, vencendo e em dia',
                'Baixa gera o lançamento sozinho',
              ]}
              preview={<ContasPreview />}
              inverter
            />
          </Reveal>
          <Reveal>
            <VitrineSecao
              titulo="Relatórios prontos pra imprimir ou declarar"
              bullets={[
                'DRE simplificada em segundos',
                'Exporte em PDF, CSV ou XLSX',
                'Extrato e faturamento por período',
              ]}
              preview={<RelatorioPreview />}
            />
          </Reveal>
        </section>

        {/* Grade de recursos completa */}
        <section className="bg-superficie px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-5xl">
            <Reveal>
              <h2 className="text-center font-display text-2xl font-semibold tracking-tight text-texto md:text-3xl">
                Tudo que o seu MEI precisa, em um só lugar
              </h2>
            </Reveal>
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {RECURSOS.map(({ icone: Icone, titulo, descricao }, i) => (
                <Reveal key={titulo} atraso={(i % 3) * 80} className="h-full">
                  <div className="h-full rounded-2xl border border-borda bg-fundo p-5 shadow-card transition-shadow hover:shadow-lg">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                      <Icone className="size-5" aria-hidden="true" />
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-texto">{titulo}</h3>
                    <p className="mt-1 text-sm text-zinc-600">{descricao}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Como funciona o acesso */}
        <section className="mx-auto max-w-5xl px-4 py-16 md:px-8 md:py-24">
          <Reveal>
            <h2 className="text-center font-display text-2xl font-semibold tracking-tight text-texto md:text-3xl">
              Como funciona o acesso
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-600 md:text-base">
              O acesso não é aberto de propósito: cada conta é criada e acompanhada por nós, sem
              burocracia extra pra você.
            </p>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {PASSOS_ACESSO.map(({ numero, icone: Icone, titulo, descricao }, i) => (
              <Reveal key={numero} atraso={i * 120}>
                <div className="text-center">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                    <Icone className="size-5" aria-hidden="true" />
                  </div>
                  <p className="mt-3 text-xs font-semibold text-acento-700">Passo {numero}</p>
                  <h3 className="mt-1 text-base font-semibold text-texto">{titulo}</h3>
                  <p className="mt-1 text-sm text-zinc-600">{descricao}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <Reveal>
          <section className="bg-primary-800 px-4 py-16 text-center md:px-8 md:py-20">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Pronto pra organizar o financeiro do seu MEI?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-primary-100 md:text-base">
              Solicite acesso agora — a resposta costuma ser rápida.
            </p>
            <div className="mt-7">
              <Button asChild size="lg">
                <Link to="/cadastro">Solicitar acesso</Link>
              </Button>
            </div>
          </section>
        </Reveal>
      </main>

      <footer className="px-4 py-6 text-center text-xs text-zinc-500">
        MEI Financeiro · controle financeiro para Microempreendedores Individuais
      </footer>
    </div>
  );
}
