/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base da API (padrão: /api/v1, via proxy do Vite em dev). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
