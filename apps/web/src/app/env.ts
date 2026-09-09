// Configuração do frontend a partir de import.meta.env (prefixo VITE_).
export const env = {
  /** Base da API; em dev passa pelo proxy do Vite (/api → 127.0.0.1:3333). */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const;
