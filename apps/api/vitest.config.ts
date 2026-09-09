import { defineConfig } from 'vitest/config';

// Cada arquivo de teste sobe um PGlite (Postgres em WASM) em memória: ~10-20 s de import por
// fork. Limitamos os workers e damos folga aos hooks para não estourar em máquinas modestas.
export default defineConfig({
  test: {
    name: 'api',
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    pool: 'forks',
    maxWorkers: 3,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
