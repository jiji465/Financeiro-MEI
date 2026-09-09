// Telefone brasileiro: armazena só dígitos (10 fixo / 11 celular), exibe com máscara.
import { onlyDigits } from './documento';

/** "11987654321" → "(11) 98765-4321"; "1133334444" → "(11) 3333-4444". Parcial enquanto digita. */
export function maskTelefone(texto: string | null | undefined): string {
  const d = onlyDigits(texto).slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function isValidTelefone(texto: string | null | undefined): boolean {
  const d = onlyDigits(texto);
  return d.length === 10 || d.length === 11;
}

/** Igual a maskTelefone, mas devolve "" para valores incompletos (exibição em listas). */
export function formatTelefone(texto: string | null | undefined): string {
  return isValidTelefone(texto) ? maskTelefone(texto) : '';
}
