// O painel real do produto, recriado em tamanho de projeto (1512px) pra rodar dentro da tela do
// notebook do hero. Não é screenshot: é o mesmo design system, então fica nítido em qualquer
// escala. A ordem é a do `DashboardPage`: alertas → resumo → atalhos → próximos vencimentos +
// limite anual. A fileira de gráficos fica de fora de propósito — ela dobra a altura da janela e
// derruba a escala final.
//
// Dados de exemplo, coerentes entre si (ninguém deve conseguir "pegar" a conta errada) e sem
// nenhuma prova social: não há depoimento, número de clientes, preço nem avaliação aqui.
import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  ChevronDown,
  FileBarChart,
  FileText,
  Gauge,
  House,
  Landmark,
  LogOut,
  PanelLeft,
  Plus,
  Receipt,
  ReceiptText,
  Settings,
  TrendingUp,
  TriangleAlert,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { formatBRL, formatPercentual } from '@/lib/format/money';
import { cn } from '@/lib/utils/cn';

import { LARGURA_JANELA } from './janela-navegador';

// Em centavos, como no produto. 42% de R$ 81.000,00 = R$ 34.020,00; sobram R$ 46.980,00.
const SALDO = 402595;
const ENTRADAS = 910000;
const SAIDAS = 507405;
const FATURADO = 3402000;
const LIMITE_PCT = 42;

const DURACAO_CONTAGEM = 1200;

const NAVEGACAO: { icone: LucideIcon; rotulo: string; ativo?: boolean }[] = [
  { icone: House, rotulo: 'Início', ativo: true },
  { icone: ArrowLeftRight, rotulo: 'Lançamentos' },
  { icone: Wallet, rotulo: 'Contas' },
  { icone: Landmark, rotulo: 'DAS' },
  { icone: Receipt, rotulo: 'Notas fiscais' },
  { icone: Users, rotulo: 'Clientes e fornecedores' },
  { icone: FileBarChart, rotulo: 'Relatórios' },
  { icone: Settings, rotulo: 'Configurações' },
];

const ATALHOS: { icone: LucideIcon; rotulo: string; bolha: string }[] = [
  { icone: Plus, rotulo: 'Nova receita', bolha: 'bg-receita-50 text-receita-700' },
  { icone: Plus, rotulo: 'Nova despesa', bolha: 'bg-despesa-50 text-despesa-700' },
  { icone: ReceiptText, rotulo: 'Nova conta', bolha: 'bg-zinc-100 text-zinc-500' },
  { icone: Landmark, rotulo: 'DAS do mês', bolha: 'bg-zinc-100 text-zinc-500' },
  { icone: FileText, rotulo: 'Nova nota fiscal', bolha: 'bg-zinc-100 text-zinc-500' },
];

const VENCIMENTOS = [
  {
    icone: ArrowUpCircle,
    nome: 'Fornecedora ABC Ltda',
    data: '12/09/2026',
    quando: 'há 3 dias',
    valor: 'R$ 350,00',
    atrasado: true,
  },
  {
    icone: Landmark,
    nome: 'DAS · setembro de 2026',
    data: '20/09/2026',
    quando: 'em 5 dias',
    valor: 'R$ 76,90',
    atrasado: false,
  },
  {
    icone: ArrowUpCircle,
    nome: 'Aluguel do ponto',
    data: '20/09/2026',
    quando: 'em 5 dias',
    valor: 'R$ 1.200,00',
    atrasado: false,
  },
  {
    icone: ArrowDownCircle,
    nome: 'Marina Duarte · parcela 2/3',
    data: '28/09/2026',
    quando: 'em 13 dias',
    valor: 'R$ 890,00',
    atrasado: false,
  },
] as const;

/** Conta de 0 até `valor` quando `repeticao` muda.
 *
 * O valor FINAL já é o estado inicial (ele existe no markup sem JS): só zeramos dentro de um
 * `requestAnimationFrame`, isto é, num quadro que realmente aconteceu. Em aba em segundo plano,
 * impressão ou captura estática o número simplesmente fica no valor certo em vez de ficar preso
 * em zero. */
function useContagem(valor: number, atrasoMs: number, repeticao: number, animar: boolean) {
  const [exibido, setExibido] = useState(valor);

  useEffect(() => {
    if (!animar || repeticao === 0) return;
    let frame = 0;
    let tempo = 0;
    frame = requestAnimationFrame(() => {
      setExibido(0);
      tempo = window.setTimeout(() => {
        const inicio = performance.now();
        const passo = (agora: number) => {
          const t = Math.min(1, (agora - inicio) / DURACAO_CONTAGEM);
          setExibido(valor * (1 - (1 - t) ** 3));
          if (t < 1) frame = requestAnimationFrame(passo);
        };
        frame = requestAnimationFrame(passo);
      }, atrasoMs);
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(tempo);
    };
  }, [valor, atrasoMs, repeticao, animar]);

  return exibido;
}

export interface PainelMockProps {
  /** Incrementa a cada disparo da entrada do hero — reinicia contagens e barra do limite. */
  repeticao?: number;
  /** Desligado com "menos movimento": tudo nasce e fica no valor final. */
  animar?: boolean;
}

export function PainelMock({ repeticao = 0, animar = true }: PainelMockProps) {
  const saldo = useContagem(SALDO, 520, repeticao, animar);
  const entradas = useContagem(ENTRADAS, 640, repeticao, animar);
  const saidas = useContagem(SAIDAS, 720, repeticao, animar);
  const faturado = useContagem(FATURADO, 820, repeticao, animar);
  const pctFaturado = useContagem(LIMITE_PCT, 820, repeticao, animar);

  // A barra nasce em 42% no markup; o JS só a zera (dentro de um quadro) pra ela encher de novo.
  const barraRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const barra = barraRef.current;
    if (!animar || repeticao === 0 || !barra) return;
    let tempo = 0;
    const frame = requestAnimationFrame(() => {
      barra.style.width = '0%';
      tempo = window.setTimeout(() => {
        barra.style.width = `${LIMITE_PCT}%`;
      }, 120);
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(tempo);
      barra.style.width = `${LIMITE_PCT}%`;
    };
  }, [repeticao, animar]);

  return (
    <div aria-hidden="true" className="flex bg-fundo text-texto" style={{ width: LARGURA_JANELA }}>
      {/* Barra lateral */}
      <div className="flex w-64 shrink-0 flex-col border-r border-borda bg-superficie">
        <div className="flex h-14 items-center gap-2 border-b border-borda px-4">
          <span className="flex size-8 items-center justify-center rounded-lg bg-acento-600 text-sm font-bold text-white">
            M
          </span>
          <span className="text-base font-semibold tracking-[-0.014em] text-primary-800">
            MEI Financeiro
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-2 py-3">
          {NAVEGACAO.map(({ icone: Icone, rotulo, ativo }) => (
            <div
              key={rotulo}
              className={cn(
                'flex h-9 items-center gap-3 rounded-md px-3 text-sm',
                ativo ? 'bg-zinc-100 font-semibold text-texto' : 'font-medium text-zinc-600',
              )}
            >
              <Icone className={cn('size-[18px]', ativo ? 'text-acento-600' : 'text-zinc-400')} />
              {rotulo}
            </div>
          ))}
        </nav>
        <div className="border-t border-borda p-2">
          <div className="flex items-center gap-3 p-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-800">
              AC
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">Ana Clara</span>
              <span className="block text-xs text-zinc-500">Ateliê Criativo</span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-1">
            <span className="flex size-10 items-center justify-center rounded-md text-zinc-500">
              <PanelLeft className="size-5" />
            </span>
            <span className="flex h-10 items-center gap-2 rounded-md px-3 text-sm text-zinc-600">
              <LogOut className="size-4" />
              Sair
            </span>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-borda bg-superficie px-8">
          <p className="text-sm font-medium text-zinc-600">Início</p>
          <div className="ml-auto flex items-center gap-2">
            <span className="flex h-10 items-center gap-2 rounded-md bg-acento-600 px-4 text-sm font-medium text-white">
              <Plus className="size-4" />
              Novo lançamento
              <ChevronDown className="-mr-1 size-4 opacity-70" />
            </span>
            <span className="flex h-10 items-center gap-2 rounded-full py-0 pr-3 pl-1">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-800">
                AC
              </span>
              <span className="text-sm font-medium">Ana Clara</span>
              <ChevronDown className="size-4 text-zinc-500" />
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-hidden px-9 pt-7 pb-13">
          <div className="mb-6">
            <h1 className="text-[26px] leading-[1.15] font-semibold tracking-[-0.014em]">
              Olá, Ateliê
            </h1>
            <p className="mt-1 text-sm leading-[1.4] text-zinc-500">
              Resumo financeiro do seu MEI neste mês.
            </p>
          </div>

          {/* Alertas */}
          <ul className="mb-5 flex flex-col gap-2">
            <li className="flex items-start gap-3 rounded-lg border border-alerta-200 border-l-[3px] border-l-alerta-500 bg-alerta-50/60 p-3">
              <TriangleAlert className="mt-0.5 size-5 shrink-0 text-alerta-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">DAS de setembro de 2026 vence em 5 dias</p>
                <span className="mt-1 inline-block text-sm font-medium text-acento-700">
                  Ver DAS do mês
                </span>
              </div>
              <span className="-mt-1 -mr-1 flex size-9 shrink-0 items-center justify-center rounded-md text-zinc-500">
                <X className="size-4" />
              </span>
            </li>
          </ul>

          {/* Resumo */}
          <div className="overflow-hidden rounded-lg border border-borda bg-superficie shadow-card">
            <div className="grid grid-cols-[1.35fr_1fr_1fr] gap-px bg-borda">
              <div className="bg-superficie p-5">
                <div className="flex items-center gap-2">
                  <p className="text-[0.8125rem] leading-5 font-medium text-zinc-500">
                    Saldo do período
                  </p>
                </div>
                <p className="mt-1.5 text-4xl font-semibold valor">
                  {formatBRL(Math.round(saldo))}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-0.5 rounded-sm bg-receita-50 px-1 py-px font-medium text-receita-700 valor">
                    <TrendingUp className="size-3" />
                    +18,4%
                  </span>
                  <span className="text-zinc-500">vs. período anterior</span>
                </div>
              </div>
              <div className="bg-superficie p-5">
                <div className="flex items-center gap-2">
                  <span className="size-1.5 shrink-0 rounded-full bg-receita-500" />
                  <p className="text-[0.8125rem] leading-5 font-medium text-zinc-500">Entradas</p>
                </div>
                <p className="mt-1.5 text-2xl font-semibold text-receita-700 valor">
                  {formatBRL(Math.round(entradas))}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-0.5 rounded-sm bg-receita-50 px-1 py-px font-medium text-receita-700 valor">
                    <TrendingUp className="size-3" />
                    +12,0%
                  </span>
                  <span className="text-zinc-500">vs. anterior</span>
                  <p className="text-zinc-500">R$ 1.480,00 ainda a receber</p>
                </div>
              </div>
              <div className="bg-superficie p-5">
                <div className="flex items-center gap-2">
                  <span className="size-1.5 shrink-0 rounded-full bg-despesa-500" />
                  <p className="text-[0.8125rem] leading-5 font-medium text-zinc-500">Saídas</p>
                </div>
                <p className="mt-1.5 text-2xl font-semibold text-despesa-700 valor">
                  {formatBRL(Math.round(saidas))}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-0.5 rounded-sm bg-despesa-50 px-1 py-px font-medium text-despesa-700 valor">
                    <TrendingUp className="size-3" />
                    +4,2%
                  </span>
                  <span className="text-zinc-500">vs. anterior</span>
                  <p className="text-zinc-500">R$ 1.522,00 ainda a pagar</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-linha bg-zinc-50 px-5 py-3">
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-zinc-500">Saldo previsto (com pendentes)</span>
                <span className="text-sm font-medium valor">R$ 3.983,95</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-zinc-500">Lançamentos no período</span>
                <span className="text-sm font-medium valor">34</span>
              </div>
            </div>
          </div>

          {/* Atalhos */}
          <div className="mt-5 flex flex-wrap gap-2">
            {ATALHOS.map(({ icone: Icone, rotulo, bolha }) => (
              <span
                key={rotulo}
                className="flex shrink-0 items-center gap-2 rounded-full border border-borda bg-superficie py-1.5 pr-3.5 pl-1.5 text-sm font-medium text-zinc-700"
              >
                <span
                  className={cn(
                    'flex size-6 items-center justify-center rounded-full p-[5px]',
                    bolha,
                  )}
                >
                  <Icone className="size-full" />
                </span>
                {rotulo}
              </span>
            ))}
          </div>

          {/* Próximos vencimentos + limite anual */}
          <div className="mt-5 grid grid-cols-[3fr_2fr] gap-5">
            <div className="rounded-lg border border-borda bg-superficie shadow-card">
              <div className="px-5 pt-5">
                <h3 className="text-[0.9375rem] leading-tight font-semibold">
                  Próximos vencimentos
                </h3>
                <p className="mt-0.5 text-sm leading-snug text-zinc-500">
                  DAS e contas dos próximos 30 dias.
                </p>
              </div>
              <div className="p-5">
                <ul className="-mx-3">
                  {VENCIMENTOS.map(({ icone: Icone, nome, data, quando, valor, atrasado }, i) => (
                    <li
                      key={nome}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5',
                        atrasado && 'border-l-2 border-l-despesa-500 bg-despesa-50/40 pl-2.5',
                        i > 0 && 'border-t border-linha',
                      )}
                    >
                      <Icone
                        className={cn(
                          'size-4 shrink-0',
                          atrasado ? 'text-despesa-600' : 'text-zinc-400',
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{nome}</p>
                        <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                          <span className="tabular-nums">{data}</span>
                          <span>·</span>
                          <span>{quando}</span>
                          {atrasado ? <Badge tone="despesa">Atrasado</Badge> : null}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold valor">{valor}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-lg border border-borda bg-superficie shadow-card">
              <div className="flex items-start justify-between gap-3 px-5 pt-5">
                <h3 className="flex items-center gap-2 text-[0.9375rem] leading-tight font-semibold">
                  <Gauge className="size-4 text-zinc-400" />
                  Limite anual 2026
                </h3>
                <Badge tone="receita" dot>
                  Dentro do limite
                </Badge>
              </div>
              <div className="p-5">
                <p className="text-zinc-500 rotulo">Faturado em 2026</p>
                <div className="mt-1 mb-2 flex flex-wrap items-baseline gap-x-2">
                  <span className="text-2xl font-semibold valor">
                    {formatBRL(Math.round(faturado))}
                  </span>
                  <span className="text-sm text-zinc-500">de R$ 81.000,00</span>
                  <span className="ml-auto text-sm font-semibold text-zinc-600 tabular-nums">
                    {formatPercentual(Math.round(pctFaturado), 0)}
                  </span>
                </div>
                <div className="pb-4">
                  <div className="relative h-2.5 w-full rounded-full bg-zinc-200">
                    <div
                      ref={barraRef}
                      className="h-full rounded-full bg-receita-600"
                      style={{
                        width: `${LIMITE_PCT}%`,
                        transition: 'width 1100ms cubic-bezier(.2,.8,.2,1)',
                      }}
                    />
                    {[70, 85, 100].map((marca) => (
                      <span
                        key={marca}
                        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${marca}%` }}
                      >
                        <span className="block h-[18px] w-0.5 bg-zinc-500/70" />
                        <span className="absolute top-full left-1/2 mt-1 -translate-x-1/2 text-[10px] leading-none whitespace-nowrap text-zinc-500">
                          {marca}%
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
                <dl className="mt-4 flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-sm text-zinc-500">Ainda pode faturar</dt>
                    <dd className="text-right text-sm font-semibold valor">R$ 46.980,00</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-sm text-zinc-500">Projeção para dezembro</dt>
                    <dd className="text-right text-sm font-medium text-zinc-700 valor">
                      R$ 72.400,00 (89,4% do limite)
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 rounded-md border border-alerta-200 bg-alerta-50 px-3 py-2 text-xs text-alerta-700">
                  No ritmo atual, o faturamento deve passar do limite até o fim do ano.
                </p>
                <p className="mt-4 text-sm text-zinc-600">
                  Restam R$ 46.980,00 de faturamento permitido em 2026.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
