// Setup do Vitest (happy-dom): matchers do jest-dom e cleanup automático entre testes.
// P1-C (Web core) acrescenta render.tsx (providers + router) e factories.ts.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
