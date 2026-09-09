import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'shared',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/index.ts', 'src/zod-pt-br.ts'],
      // Regras de domínio: ≥ 95% linhas / 90% branches (seção 9 do plano, WP P1-A).
      thresholds: {
        'src/domain/**': {
          lines: 95,
          statements: 95,
          functions: 95,
          branches: 90,
        },
      },
    },
  },
});
