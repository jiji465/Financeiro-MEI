// Download de arquivos no navegador (CSV/PDF gerados pela API).
import { api, type RequestOptions } from './client';

/** Dispara o download de um Blob com o nome informado. */
export function baixarBlob(blob: Blob, nomeArquivo: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Dá tempo ao navegador de iniciar o download antes de liberar a URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Busca `path` na API e salva o arquivo. Usa o nome do Content-Disposition; senão `nomePadrao`.
 * Ex.: `await baixarDaApi('/relatorios/dre', 'dre.pdf', { query: { formato: 'pdf', ano: 2026 } })`
 */
export async function baixarDaApi(
  path: string,
  nomePadrao: string,
  opts?: RequestOptions,
): Promise<void> {
  const { blob, nomeArquivo } = await api.blob(path, opts);
  baixarBlob(blob, nomeArquivo ?? nomePadrao);
}
