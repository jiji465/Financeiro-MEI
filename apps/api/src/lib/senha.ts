// Hash de senha com scrypt do node:crypto (sem dependências nativas).
// Formato armazenado: scrypt$N$r$p$<salt base64>$<hash base64>. Comparação em tempo constante.
import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';

const N_PADRAO = 16384;
const R_PADRAO = 8;
const P_PADRAO = 1;
const TAMANHO_SALT = 16;
const TAMANHO_HASH = 64;

function derivar(
  senha: string,
  salt: Buffer,
  params: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      senha,
      salt,
      TAMANHO_HASH,
      { N: params.N, r: params.r, p: params.p, maxmem: 128 * params.N * params.r * 2 },
      (erro, chave) => (erro ? reject(erro) : resolve(chave)),
    );
  });
}

export async function hashSenha(senha: string): Promise<string> {
  const salt = randomBytes(TAMANHO_SALT);
  const hash = await derivar(senha, salt, { N: N_PADRAO, r: R_PADRAO, p: P_PADRAO });
  return ['scrypt', N_PADRAO, R_PADRAO, P_PADRAO, salt.toString('base64'), hash.toString('base64')]
    .map(String)
    .join('$');
}

/** Devolve false para hashes malformados (nunca lança por causa do formato). */
export async function verificarSenha(senha: string, armazenado: string): Promise<boolean> {
  const partes = armazenado.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const N = Number(partes[1]);
  const r = Number(partes[2]);
  const p = Number(partes[3]);
  if (![N, r, p].every((n) => Number.isInteger(n) && n > 0)) return false;
  const salt = Buffer.from(partes[4] ?? '', 'base64');
  const esperado = Buffer.from(partes[5] ?? '', 'base64');
  if (salt.length === 0 || esperado.length === 0) return false;
  const calculado = await derivar(senha, salt, { N, r, p });
  if (calculado.length !== esperado.length) return false;
  return timingSafeEqual(calculado, esperado);
}

/** Alfabeto sem caracteres ambíguos (sem 0/O, 1/l/I) para senhas temporárias legíveis. */
const ALFABETO_SENHA_TEMPORARIA = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';

/** Senha temporária gerada com fonte de aleatoriedade criptográfica (node:crypto), para ser
 * entregue de verdade a uma pessoa (criação de conta ou redefinição pelo admin) — diferente da
 * sugestão editável do formulário do frontend, que usa Math.random(). */
export function gerarSenhaTemporaria(tamanho = 12): string {
  let saida = '';
  for (let i = 0; i < tamanho; i++) {
    saida += ALFABETO_SENHA_TEMPORARIA[randomInt(ALFABETO_SENHA_TEMPORARIA.length)];
  }
  return saida;
}
