// Ações do botão "Novo" (topbar, no desktop) e do botão flutuante "+" (celular).
//
// Fonte ÚNICA das duas telas de propósito: as listas viviam duplicadas e saíram de sincronia —
// o desktop ganhou produto/serviço e o celular ficou só com receita/despesa, e nenhum dos dois
// levava a cliente/fornecedor, embora a tela já existisse.
import { Building2, Package, TrendingDown, TrendingUp, UserRound, Wrench } from 'lucide-react';
import type { ComponentType } from 'react';

export interface AcaoNova {
  id: string;
  label: string;
  to: string;
  icone: ComponentType<{ className?: string }>;
  /** Só as duas de lançamento têm cor: são o que o dono faz todo dia. */
  tone?: 'receita' | 'despesa';
}

export interface GrupoAcoesNovo {
  /** Sem rótulo no primeiro grupo: o menu já se chama "Novo". */
  label?: string;
  acoes: AcaoNova[];
}

export const GRUPOS_NOVO: GrupoAcoesNovo[] = [
  {
    acoes: [
      {
        id: 'receita',
        label: 'Nova receita',
        to: '/lancamentos?novo=receita',
        icone: TrendingUp,
        tone: 'receita',
      },
      {
        id: 'despesa',
        label: 'Nova despesa',
        to: '/lancamentos?novo=despesa',
        icone: TrendingDown,
        tone: 'despesa',
      },
    ],
  },
  {
    label: 'Cadastros',
    acoes: [
      {
        id: 'cliente',
        label: 'Novo cliente',
        to: '/contatos/novo?tipo=cliente',
        icone: UserRound,
      },
      {
        id: 'fornecedor',
        label: 'Novo fornecedor',
        to: '/contatos/novo?tipo=fornecedor',
        // Mesmos ícones do seletor de tipo em contato-form.tsx: pessoa = cliente, prédio =
        // fornecedor. Quem já viu o formulário reconhece o atalho.
        icone: Building2,
      },
    ],
  },
  {
    label: 'Catálogo',
    acoes: [
      {
        id: 'produto',
        label: 'Novo produto',
        to: '/produtos-servicos?novo=produto',
        icone: Package,
      },
      {
        id: 'servico',
        label: 'Novo serviço',
        to: '/produtos-servicos?novo=servico',
        icone: Wrench,
      },
    ],
  },
];

/** As duas ações em destaque do celular (cartões grandes na folha do "+"). */
export const ACOES_DESTAQUE = GRUPOS_NOVO[0]!.acoes;

/** O resto, em lista, abaixo dos cartões. */
export const ACOES_SECUNDARIAS = GRUPOS_NOVO.slice(1).flatMap((g) => g.acoes);
