// Localiza a raiz de apps/api tanto rodando de src/ (tsx) quanto de dist/src/ (node).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

let raizCache: string | undefined;

export function apiRootDir(): string {
  if (raizCache) return raizCache;
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    const pkg = join(dir, 'package.json');
    if (existsSync(pkg)) {
      try {
        const json = JSON.parse(readFileSync(pkg, 'utf8')) as { name?: string };
        if (json.name === '@meifin/api') {
          raizCache = dir;
          return dir;
        }
      } catch {
        // ignora package.json inválido e continua subindo
      }
    }
    const pai = dirname(dir);
    if (pai === dir) break;
    dir = pai;
  }
  throw new Error('Não foi possível localizar a raiz de apps/api (package.json @meifin/api)');
}

export function repoRootDir(): string {
  return resolve(apiRootDir(), '..', '..');
}

export function migrationsDir(): string {
  return join(apiRootDir(), 'drizzle');
}

export function apiVersion(): string {
  const json = JSON.parse(readFileSync(join(apiRootDir(), 'package.json'), 'utf8')) as {
    version?: string;
  };
  return json.version ?? '0.0.0';
}
