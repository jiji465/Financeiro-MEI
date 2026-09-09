// Serializa parâmetros de query descartando undefined, null e ''. Arrays viram chaves repetidas.
export type QueryValor = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValor | readonly QueryValor[]>;

export function toQueryString(params?: QueryParams): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    const lista: readonly QueryValor[] = Array.isArray(valor)
      ? (valor as readonly QueryValor[])
      : [valor as QueryValor];
    for (const item of lista) {
      if (item === undefined || item === null || item === '') continue;
      search.append(chave, String(item));
    }
  }
  const texto = search.toString();
  return texto ? `?${texto}` : '';
}
