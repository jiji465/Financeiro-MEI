import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

export interface SearchParamsStateOptions {
  /** Usa history.replace em vez de push (padrão: true — filtros não poluem o histórico). */
  replace?: boolean;
}

/**
 * Estado sincronizado com a query string (filtros de lista, abas, `?novo=receita`).
 * `set(undefined | '' | padrão)` remove a chave da URL.
 */
export function useSearchParamsState(
  chave: string,
  padrao = '',
  opcoes: SearchParamsStateOptions = {},
): [string, (valor: string | null | undefined) => void] {
  const [params, setParams] = useSearchParams();
  const replace = opcoes.replace ?? true;
  const valor = params.get(chave) ?? padrao;

  const set = useCallback(
    (novo: string | null | undefined) => {
      setParams(
        (atual) => {
          const proximo = new URLSearchParams(atual);
          if (novo === undefined || novo === null || novo === '' || novo === padrao) {
            proximo.delete(chave);
          } else {
            proximo.set(chave, novo);
          }
          return proximo;
        },
        { replace },
      );
    },
    [chave, padrao, replace, setParams],
  );

  return [valor, set];
}

/**
 * Várias chaves de uma vez (ex.: { de, ate, tipo }). `patch` mescla e remove valores vazios.
 */
export function useSearchParamsObject<K extends string>(
  chaves: readonly K[],
  opcoes: SearchParamsStateOptions = {},
): [Record<K, string>, (patch: Partial<Record<K, string | null | undefined>>) => void] {
  const [params, setParams] = useSearchParams();
  const replace = opcoes.replace ?? true;
  const valores = {} as Record<K, string>;
  for (const k of chaves) valores[k] = params.get(k) ?? '';

  const patch = useCallback(
    (mudancas: Partial<Record<K, string | null | undefined>>) => {
      setParams(
        (atual) => {
          const proximo = new URLSearchParams(atual);
          for (const [k, v] of Object.entries(mudancas) as [K, string | null | undefined][]) {
            if (v === undefined || v === null || v === '') proximo.delete(k);
            else proximo.set(k, v);
          }
          return proximo;
        },
        { replace },
      );
    },
    [replace, setParams],
  );

  return [valores, patch];
}
