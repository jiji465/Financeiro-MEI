import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** navigator.onLine reativo (banner offline). */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (typeof navigator === 'undefined' ? true : navigator.onLine),
    () => true,
  );
}
