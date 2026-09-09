import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Proxy /api → API local. Sempre 127.0.0.1 (nunca localhost: no Windows pode resolver para ::1).
// WEB_PORT e API_PORT permitem subir várias instâncias em paralelo (ex.: agentes/testes).
const webPort = Number(process.env.WEB_PORT ?? 5173);
const apiPort = Number(process.env.API_PORT ?? 3333);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: '127.0.0.1',
    port: webPort,
    strictPort: true,
    proxy: {
      '/api': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: false },
    },
  },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  // WEB_BUILD_OUT_DIR permite redirecionar o build para outra pasta (ex.: a Vercel espera o
  // resultado em "dist" na raiz do repositório, não em apps/web/dist). Sem a variável, o padrão
  // continua apps/web/dist — usado localmente e pelo deploy single-service (SERVE_WEB=true).
  build: {
    outDir: process.env.WEB_BUILD_OUT_DIR ?? 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
  test: {
    name: 'web',
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    pool: 'forks',
    css: false,
  },
});
