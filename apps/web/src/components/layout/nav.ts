// Navegação derivada do registry (src/app/registry.ts). Cada feature declara seus NavItem;
// aqui apenas ordenamos, agrupamos e escolhemos os 4 atalhos da barra inferior.
//
// Não há mais item sintético nem lista de reserva: "Visão geral" é declarada por
// features/dashboard como qualquer outra, e as quatro features do rodapé já marcam `mobile: true`.
// A lista de reserva que existia aqui repetia rotas ("/contas/pagar") e viraria uma armadilha
// silenciosa se alguma feature mudasse a sua.
import { navItems, type NavItem } from '@/app/registry';

export interface NavGrupo {
  id: string;
  label?: string;
  itens: NavItem[];
}

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

/** Itens da sidebar: o registry inteiro, por ordem. */
export function itensSidebar(itens: readonly NavItem[] = navItems): NavItem[] {
  return ordenar(itens);
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

/** Os 4 atalhos da barra inferior: os itens com `mobile: true`, por ordem. */
export function bottomNavSlots(itens: readonly NavItem[] = navItems): NavItem[] {
  return ordenar(itens.filter((i) => i.mobile)).slice(0, 4);
}

/** Itens que não cabem na barra inferior (vão para a folha "Mais"). */
export function itensMais(itens: readonly NavItem[] = navItems): NavItem[] {
  const slots = bottomNavSlots(itens);
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
