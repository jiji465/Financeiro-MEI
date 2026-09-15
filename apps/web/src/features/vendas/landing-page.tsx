// Página de vendas pública: o que aparece em "/" para quem não está logado (seção 11 do plano).
// Quem está logado nunca vê esta página — RequireAuth mostra o AppShell/dashboard normalmente.
//
// Ordem das seções (pensada como funil, não como lista de features):
//   hero (a pergunta que o MEI não sabe responder) → prova rápida → as 3 dores reconhecíveis →
//   3 blocos com o produto respondendo cada dor → o que mais vem junto → objeções → como o
//   acesso funciona → CTA final.
// Toda alavanca aqui é verificável dentro do produto. NÃO existe depoimento, número de clientes,
// logo de empresa, prêmio nem preço — não invente nenhum desses.
import {
  BarChart3,
  CalendarClock,
  FileText,
  Landmark,
  MessageCircle,
  Receipt,
  ShieldCheck,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';

import { CabecalhoVendas } from './components/cabecalho-vendas';
import { HeroZoom } from './components/hero-zoom';
import { ContasPreview, DasPreview, RelatorioPreview, SeloCheck } from './components/previews';
import { Reveal } from './components/reveal';
import { VitrineSecao } from './components/vitrine-secao';

const CONFIANCA = [
  'DAS calculado pela regra da sua atividade',
  'Aviso antes de estourar o limite anual',
  'Relatórios em PDF, CSV e XLSX',
  'Escrito pra quem não entende de contabilidade',
];

const DORES = [
  {
    icone: Wallet,
    dor: '“Vendi bem, mas cadê o dinheiro?”',
    resposta:
      'Receita menos despesa, mês a mês, sem fórmula de planilha. Você abre o painel e vê o que sobrou.',
  },
  {
    icone: CalendarClock,
    dor: '“De novo esqueci o DAS.”',
    resposta:
      'O calendário do ano inteiro fica montado e o sistema avisa antes do vencimento, não depois da multa.',
  },
  {
    icone: FileText,
    dor: '“O contador pediu um relatório e eu não tenho.”',
    resposta:
      'DRE, extrato e faturamento prontos por período — exporta em PDF, CSV ou XLSX na hora.',
  },
] as const;

const RECURSOS = [
  {
    icone: Wallet,
    titulo: 'Lançamentos que se repetem sozinhos',
    descricao:
      'Receitas e despesas com recorrência, anexo do comprovante e importação por CSV de quem já tem planilha.',
  },
  {
    icone: Receipt,
    titulo: 'Contas a pagar e a receber',
    descricao:
      'Parcelamento automático e baixa em um clique — que já vira lançamento, sem você digitar duas vezes.',
  },
  {
    icone: Landmark,
    titulo: 'DAS, DASN-SIMEI e limite anual',
    descricao:
      'Calendário mensal, lembrete da declaração anual e o quanto você ainda pode faturar no ano.',
  },
  {
    icone: FileText,
    titulo: 'Notas fiscais registradas',
    descricao: 'Guarde as notas emitidas junto do lançamento — na hora da declaração está tudo lá.',
  },
  {
    icone: Users,
    titulo: 'Clientes e fornecedores',
    descricao:
      'Um cadastro só, com o histórico de quem mais compra de você e de quanto você gasta.',
  },
  {
    icone: BarChart3,
    titulo: 'Painel e relatórios',
    descricao:
      'Gráfico dos últimos 12 meses, DRE simplificada, extrato e faturamento por período, exportáveis.',
  },
] as const;

const OBJECOES = [
  {
    pergunta: 'Eu já uso uma planilha.',
    resposta:
      'Então você já tem metade do trabalho feito: dá pra importar o que está lá por CSV. A diferença é que aqui o total se atualiza sozinho, o DAS aparece no calendário e ninguém apaga uma fórmula sem querer.',
  },
  {
    pergunta: 'Não entendo nada de contabilidade.',
    resposta:
      'Nem precisa. Você responde se entrou ou saiu, quanto e de quem. Os nomes difíceis (DRE, DASN-SIMEI, limite proporcional) o sistema monta e explica em português.',
  },
  {
    pergunta: 'Vou ter que migrar tudo de uma vez?',
    resposta:
      'Não. Comece pelo mês atual, que já é suficiente pra fechar o próximo DAS. O histórico antigo você traz depois, por CSV ou aos poucos.',
  },
  {
    pergunta: 'Por que o acesso não é aberto?',
    resposta:
      'Porque a conta sai pronta: já configurada com a atividade do seu MEI, os tributos certos e o mês em que você abriu. É uma conversa rápida em vez de um cadastro em que você teria que adivinhar as opções.',
  },
] as const;

const PASSOS_ACESSO = [
  {
    numero: '1',
    icone: MessageCircle,
    titulo: 'Você pede acesso',
    descricao: 'Nome, e-mail e o que o seu MEI faz. Menos de um minuto, sem preparar nada antes.',
  },
  {
    numero: '2',
    icone: UserCheck,
    titulo: 'A gente conversa',
    descricao: 'Confirmamos a atividade e os tributos do seu CNPJ pra configurar a conta certa.',
  },
  {
    numero: '3',
    icone: ShieldCheck,
    titulo: 'Sua conta chega pronta',
    descricao:
      'Você recebe o acesso com a atividade, os tributos e o mês de abertura já ajustados.',
  },
] as const;

export function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-fundo">
      <CabecalhoVendas />

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

        {/* As dores, na boca do próprio MEI */}
        <section className="mx-auto max-w-5xl px-4 py-16 md:px-8 md:py-20">
          <Reveal>
            <h2 className="text-center font-display text-2xl font-semibold tracking-tight text-texto md:text-3xl">
              Se você já falou alguma dessas frases
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-center text-sm text-zinc-600 md:text-base">
              Não é falta de jeito com dinheiro. É falta de um lugar onde as contas do seu MEI se
              somem sozinhas.
            </p>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {DORES.map(({ icone: Icone, dor, resposta }, i) => (
              <Reveal key={dor} atraso={i * 100} className="h-full">
                <div className="h-full rounded-2xl border border-borda bg-superficie p-5 shadow-card">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
                    <Icone className="size-5" aria-hidden="true" />
                  </div>
                  <p className="mt-3 text-base font-semibold text-texto">{dor}</p>
                  <p className="mt-2 text-sm text-zinc-600">{resposta}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Vitrine: o produto respondendo cada dor, com números da própria tela */}
        <section className="mx-auto max-w-6xl space-y-20 px-4 pb-16 md:space-y-28 md:pb-24">
          <Reveal>
            <VitrineSecao
              titulo="No fim do mês, você sabe quanto sobrou"
              descricao="Sem somar nada à mão: o que entrou menos o que saiu, no mês que você escolher."
              bullets={[
                'Lançou receita e despesa, o resultado do mês já fica calculado',
                'O que se repete todo mês você cadastra uma vez só',
                'Exporte em PDF, CSV ou XLSX quando o contador ou o banco pedir',
              ]}
              preview={<RelatorioPreview />}
            />
          </Reveal>
          <Reveal>
            <VitrineSecao
              titulo="O DAS deixa de ser uma data pra lembrar"
              descricao="O calendário do ano inteiro já vem montado, com o valor da sua atividade."
              bullets={[
                'Valor calculado pela regra vigente do MEI (INSS, ICMS e ISS conforme a atividade)',
                'Aviso antes do vencimento e baixa em um clique quando pagar',
                'Acompanha o limite anual e avisa quanto você ainda pode faturar',
              ]}
              preview={<DasPreview />}
              inverter
            />
          </Reveal>
          <Reveal>
            <VitrineSecao
              titulo="O que vence essa semana, na sua frente"
              descricao="Contas a pagar e a receber agrupadas por urgência — o atrasado aparece primeiro."
              bullets={[
                'Compra parcelada vira uma conta por parcela, automaticamente',
                'Vencidas, próximos 7 dias, próximos 30 — com o total de cada grupo',
                'Dar baixa já gera o lançamento, sem digitar duas vezes',
              ]}
              preview={<ContasPreview />}
            />
          </Reveal>
        </section>

        {/* Grade de recursos completa */}
        <section className="bg-superficie px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-5xl">
            <Reveal>
              <h2 className="text-center font-display text-2xl font-semibold tracking-tight text-texto md:text-3xl">
                E tudo isso já vem junto
              </h2>
            </Reveal>
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {RECURSOS.map(({ icone: Icone, titulo, descricao }, i) => (
                <Reveal key={titulo} atraso={(i % 3) * 80} className="h-full">
                  <div className="h-full rounded-2xl border border-borda bg-fundo p-5 shadow-card transition-shadow hover:shadow-card-hover">
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

        {/* Objeções */}
        <section className="mx-auto max-w-4xl px-4 py-16 md:px-8 md:py-24">
          <Reveal>
            <h2 className="text-center font-display text-2xl font-semibold tracking-tight text-texto md:text-3xl">
              O que costumam perguntar antes
            </h2>
          </Reveal>
          <dl className="mt-10 grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-2">
            {OBJECOES.map(({ pergunta, resposta }, i) => (
              <Reveal key={pergunta} atraso={(i % 2) * 100}>
                <dt className="text-base font-semibold text-texto">{pergunta}</dt>
                <dd className="mt-2 text-sm text-zinc-600 md:text-base">{resposta}</dd>
              </Reveal>
            ))}
          </dl>
        </section>

        {/* Como funciona o acesso */}
        <section className="border-t border-borda bg-superficie px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-5xl">
            <Reveal>
              <h2 className="text-center font-display text-2xl font-semibold tracking-tight text-texto md:text-3xl">
                Como você entra
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-600 md:text-base">
                Tem uma etapa a mais de propósito: é ela que faz a sua conta chegar pronta em vez de
                vazia.
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
          </div>
        </section>

        {/* CTA final */}
        <Reveal>
          <section className="bg-primary-800 px-4 py-16 text-center md:px-8 md:py-20">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Comece sabendo quanto sobra
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-primary-100 md:text-base">
              Leva menos de um minuto pra pedir. A gente responde, tira suas dúvidas e libera o seu
              acesso.
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
