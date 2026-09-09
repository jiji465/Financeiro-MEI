// Guarda estática do isolamento (seção 6 do plano): chamadas diretas a
// db/tx/exec.select|insert|update|delete|execute( só podem existir em repositories, core.ts,
// lib/tenant-db.ts e src/db/** (schema, seeds, scripts). Services/rotas usam forTenant e repositories.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');

const PADRAO = /\b(?:db|tx|exec|executor)\s*\.\s*(?:select|insert|update|delete|execute)\s*\(/;

function permitido(relativo: string): boolean {
  const posix = relativo.split(sep).join('/');
  if (posix.startsWith('db/')) return true;
  if (posix === 'lib/tenant-db.ts') return true;
  if (/(^|\/)core\.ts$/.test(posix)) return true;
  if (/repository\.ts$/.test(posix)) return true;
  return false;
}

function listarTs(dir: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      saida.push(...listarTs(caminho));
    } else if (/\.ts$/.test(nome) && !/\.(test|d)\.ts$/.test(nome)) {
      saida.push(caminho);
    }
  }
  return saida;
}

describe('guarda estática: acesso ao banco só em repositories/core', () => {
  it('nenhum service/rota chama db.select/insert/update/delete diretamente', () => {
    const violacoes: string[] = [];
    for (const arquivo of listarTs(SRC)) {
      const relativo = relative(SRC, arquivo);
      if (permitido(relativo)) continue;
      const linhas = readFileSync(arquivo, 'utf8').split('\n');
      linhas.forEach((linha, i) => {
        if (linha.trimStart().startsWith('//')) return;
        if (PADRAO.test(linha)) violacoes.push(`${relativo.split(sep).join('/')}:${i + 1}`);
      });
    }
    expect(
      violacoes,
      `Acesso direto ao banco fora de *repository.ts / core.ts:\n${violacoes.join('\n')}`,
    ).toEqual([]);
  });

  it('a lista de arquivos permitidos inclui os repositories do P1-B (sanidade)', () => {
    expect(permitido(join('modules', 'auth', 'repository.ts'))).toBe(true);
    expect(permitido(join('modules', 'lancamentos', 'core.ts'))).toBe(true);
    expect(permitido(join('modules', 'auth', 'service.ts'))).toBe(false);
    expect(permitido(join('modules', 'auth', 'routes.ts'))).toBe(false);
  });
});
