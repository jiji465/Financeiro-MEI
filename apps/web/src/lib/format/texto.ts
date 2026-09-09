// Utilitários de texto em pt-BR.

/** plural(3, 'lançamento') → "3 lançamentos"; plural(1, 'mês', 'meses') → "1 mês". */
export function plural(n: number, singular: string, pluralForma?: string): string {
  const forma = n === 1 ? singular : (pluralForma ?? `${singular}s`);
  return `${n.toLocaleString('pt-BR')} ${forma}`;
}

/** Corta o texto em `max` caracteres acrescentando "…". */
export function truncate(texto: string | null | undefined, max = 40): string {
  const t = (texto ?? '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** "Maria da Silva" → "MS" (primeiro e último nome; máx. 2 letras). */
export function iniciais(nome: string | null | undefined): string {
  const partes = (nome ?? '')
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0 && !/^(da|de|do|das|dos|e)$/i.test(p));
  if (partes.length === 0) return '?';
  const primeira = partes[0]?.charAt(0) ?? '';
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.charAt(0) ?? '') : '';
  return `${primeira}${ultima}`.toUpperCase();
}

/** Primeira letra maiúscula. */
export function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Remove acentos e baixa a caixa para buscas ("Ação" → "acao"). */
export function normalizarBusca(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Primeiro nome ("Maria da Silva" → "Maria"). */
export function primeiroNome(nome: string | null | undefined): string {
  return (nome ?? '').trim().split(/\s+/)[0] ?? '';
}

/** Junta itens com vírgula e "e" no final: ["a","b","c"] → "a, b e c". */
export function listarComE(itens: readonly string[]): string {
  if (itens.length <= 1) return itens[0] ?? '';
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}
