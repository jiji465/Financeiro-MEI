// Setup do Vitest (happy-dom): matchers do jest-dom, cleanup e polyfills que o Radix/recharts
// esperam do navegador. Também zera a store de sessão entre testes.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

import { useAuthStore } from '@/features/auth/store';

if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }
  if (!('ResizeObserver' in window)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (window as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
      ResizeObserverStub;
  }
  const proto = window.Element.prototype as Element & {
    scrollIntoView?: () => void;
    hasPointerCapture?: () => boolean;
    setPointerCapture?: () => void;
    releasePointerCapture?: () => void;
  };
  proto.scrollIntoView ??= () => {};
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (cb: FrameRequestCallback) => window.setTimeout(() => cb(0), 0);
  }
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useAuthStore.setState({ accessToken: null, user: null, tenant: null, bootstrapped: false });
});
