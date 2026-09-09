// Registro de features do frontend. Criado no Phase 0 com TODAS as features; ninguém edita depois —
// cada WP preenche apenas src/features/<feature>/**. O router monta as rotas e o layout monta a
// navegação (sidebar/bottom nav) a partir daqui.
import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router';

import { adminModule } from '@/features/admin';
import { authModule } from '@/features/auth';
import { configuracoesModule } from '@/features/configuracoes';
import { contasModule } from '@/features/contas';
import { contatosModule } from '@/features/contatos';
import { dasModule } from '@/features/das';
import { dashboardModule } from '@/features/dashboard';
import { lancamentosModule } from '@/features/lancamentos';
import { notasModule } from '@/features/notas';
import { referenciasModule } from '@/features/referencias';
import { relatoriosModule } from '@/features/relatorios';

export interface NavItem {
  id: string;
  label: string;
  to: string;
  icon?: ComponentType<{ className?: string }>;
  /** Ordem na sidebar (menor primeiro). */
  ordem?: number;
  /** Aparece na barra inferior mobile (máx. 4 + "Mais"). */
  mobile?: boolean;
  /** Só aparece para usuários com admin=true (painel de administração). */
  somenteAdmin?: boolean;
}

export interface AppModule {
  id: string;
  /** Rotas montadas pelo router (páginas públicas em auth; as demais dentro do shell autenticado). */
  routes: RouteObject[];
  nav: NavItem[];
}

export const modules: readonly AppModule[] = [
  authModule,
  referenciasModule,
  dashboardModule,
  lancamentosModule,
  contasModule,
  contatosModule,
  notasModule,
  dasModule,
  relatoriosModule,
  configuracoesModule,
  adminModule,
];

export const navItems: readonly NavItem[] = modules
  .flatMap((m) => m.nav)
  .sort((a, b) => (a.ordem ?? 100) - (b.ordem ?? 100));
