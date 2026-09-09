// Tokens opacos (refresh e redefinição de senha): aleatórios, guardados só como sha256 no banco.
import { createHash, randomBytes } from 'node:crypto';

/** Token aleatório em base64url (256 bits por padrão). */
export function gerarToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** sha256 hex do token — o que vai para o banco. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
