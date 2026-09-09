import { useSyncExternalStore } from 'react';

function subscribe(query: string) {
  return (onChange: () => void) => {
    if (typeof window === 'undefined' || !window.matchMedia) return () => {};
    const mql = window.matchMedia(query);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  };
}

/** Reage a uma media query CSS (ex.: "(max-width: 767px)"). SSR-safe (false no servidor). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    subscribe(query),
    () =>
      typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false,
    () => false,
  );
}

/** Breakpoint md do Tailwind: abaixo de 768px é "mobile" (bottom nav, sheets, cards). */
export const MOBILE_QUERY = '(max-width: 767px)';

export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}
