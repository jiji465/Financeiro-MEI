// Remove artefatos de build/teste sem depender de shell (funciona igual no Windows e no Linux).
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PASTAS_ALVO = [
  'dist',
  'coverage',
  '.data',
  '.vite',
  'node_modules/.tmp',
  'node_modules/.tsc',
];

function pacotes(): string[] {
  const resultado = [raiz];
  for (const grupo of ['apps', 'packages']) {
    const dir = join(raiz, grupo);
    if (!existsSync(dir)) continue;
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) resultado.push(caminho);
    }
  }
  resultado.push(join(raiz, 'scripts'));
  return resultado;
}

let removidos = 0;
for (const pacote of pacotes()) {
  for (const alvo of PASTAS_ALVO) {
    const caminho = join(pacote, alvo);
    if (existsSync(caminho)) {
      rmSync(caminho, { recursive: true, force: true });
      console.log(`removido: ${caminho}`);
      removidos++;
    }
  }
  if (!existsSync(pacote)) continue;
  for (const nome of readdirSync(pacote)) {
    if (nome.endsWith('.tsbuildinfo')) {
      rmSync(join(pacote, nome), { force: true });
      console.log(`removido: ${join(pacote, nome)}`);
      removidos++;
    }
  }
}
console.log(removidos === 0 ? 'Nada para limpar.' : `Limpeza concluída (${removidos} itens).`);
