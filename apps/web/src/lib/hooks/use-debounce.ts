import { useEffect, useMemo, useRef, useState } from 'react';

/** Devolve `value` só depois de `ms` sem alterações (buscas, filtros). */
export function useDebounce<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/** Versão para callbacks: a função devolvida é estável e só dispara após `ms` sem chamadas. */
export function useDebouncedCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  ms = 300,
): (...args: A) => void {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
  return useMemo(
    () =>
      (...args: A) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => fnRef.current(...args), ms);
      },
    [ms],
  );
}
