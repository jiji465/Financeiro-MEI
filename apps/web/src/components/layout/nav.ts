// Navegação derivada do registry (src/app/registry.ts). Cada feature declara seus NavItem;
// aqui apenas ordenamos, agrupamos e escolhemos os 4 atalhos da barra inferior.
import { ArrowLeftRight, House, Landmark, Wallet } from 'lucide-react';

import { navItems, type NavItem } from '@/app/registry';

export interface NavGrupo {
  id: string;
  label?: string;
  itens: NavItem[];
}

const INICIO: NavItem = {
  id: 'inicio',
  label: 'Início',
  to: '/',
  icon: House,
  ordem: 0,
  mobile: true,
};

/** Itens padrão da barra inferior enquanto as features não registram `mobile: true`. */
export const BOTTOM_NAV_PADRAO: readonly NavItem[] = [
  INICIO,
  { id: 'lancamentos', label: 'Lançamentos', to: '/lancamentos', icon: ArrowLeftRight, ordem: 10 },
  { id: 'contas', label: 'Contas', to: '/contas/pagar', icon: Wallet, ordem: 20 },
  { id: 'das', label: 'DAS', to: '/das', icon: Landmark, ordem: 40 },
];

/** Filtra a navegação pelo tipo de conta: um administrador puro (tenant interno, sem MEI de
 * verdade — seção 13 do plano) só vê os itens `somenteAdmin`; qualquer outra conta (inclusive um
 * admin híbrido, dono de um MEI real) só perde os itens `somenteAdmin` se não for admin. */
export function filtrarNav(
  itens: readonly NavItem[],
  { admin, interno }: { admin: boolean; interno: boolean },
): NavItem[] {
  if (interno) return itens.filter((i) => i.somenteAdmin);
  return admin ? [...itens] : itens.filter((i) => !i.somenteAdmin);
}

function grupoDe(item: NavItem): string | undefined {
  // `grupo` é opcional e pode não existir no tipo; respeitamos se a feature informar.
  const g = (item as NavItem & { grupo?: unknown }).grupo;
  return typeof g === 'string' && g ? g : undefined;
}

function ordenar(itens: readonly NavItem[]): NavItem[] {
  return [...itens].sort((a, b) => (a.ordem ?? 100) - (b.ordem ?? 100));
}

/** Itens da sidebar: registry + "Início" quando nenhuma feature registra a rota "/". */
export function itensSidebar(itens: readonly NavItem[] = navItems): NavItem[] {
  const temInicio = itens.some((i) => i.to === '/');
  return ordenar(temInicio ? itens : [INICIO, ...itens]);
}

/** Agrupa por `grupo` (quando presente) preservando a ordem. Itens sem grupo ficam no grupo "". */
export function agruparNav(itens: readonly NavItem[] = itensSidebar()): NavGrupo[] {
  const grupos = new Map<string, NavGrupo>();
  for (const item of ordenar(itens)) {
    const chave = grupoDe(item) ?? '';
    let grupo = grupos.get(chave);
    if (!grupo) {
      grupo = { id: chave || 'principal', label: chave || undefined, itens: [] };
      grupos.set(chave, grupo);
    }
    grupo.itens.push(item);
  }
  return [...grupos.values()];
}

/** Os 4 atalhos da barra inferior: itens com `mobile: true` (por ordem), completados pelo padrão
 * enquanto as features não registram `mobile: true`. `semPadrao` desliga esse complemento — usado
 * para um administrador puro (seção 13 do plano), que só tem "Administração" (mobile: false) e
 * não deveria ganhar de volta os atalhos de MEI que o filtro de navegação escondeu. */
export function bottomNavSlots(
  itens: readonly NavItem[] = navItems,
  { semPadrao = false }: { semPadrao?: boolean } = {},
): NavItem[] {
  const marcados = ordenar(itens.filter((i) => i.mobile)).slice(0, 4);
  if (!marcados.some((i) => i.to === '/')) marcados.unshift(INICIO);
  const slots = marcados.slice(0, 4);
  if (!semPadrao) {
    for (const padrao of BOTTOM_NAV_PADRAO) {
      if (slots.length >= 4) break;
      if (!slots.some((s) => s.to === padrao.to)) slots.push(padrao);
    }
  }
  return ordenar(slots);
}

/** Itens que não cabem na barra inferior (vão para a folha "Mais"). */
export function itensMais(
  itens: readonly NavItem[] = navItems,
  opcoes: { semPadrao?: boolean } = {},
): NavItem[] {
  const slots = bottomNavSlots(itens, opcoes);
  return itensSidebar(itens).filter((i) => !slots.some((s) => s.to === i.to));
}

/** Verdadeiro quando `pathname` está "dentro" do destino (prefixo por segmento). */
export function rotaAtiva(to: string, pathname: string): boolean {
  if (to === '/') return pathname === '/';
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** Item de navegação que melhor descreve a rota atual (prefixo mais longo). */
export function itemDaRota(
  pathname: string,
  itens: readonly NavItem[] = itensSidebar(),
): NavItem | undefined {
  let melhor: NavItem | undefined;
  for (const item of itens) {
    if (rotaAtiva(item.to, pathname) && (!melhor || item.to.length > melhor.to.length))
      melhor = item;
  }
  return melhor;
}
