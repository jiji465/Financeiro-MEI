// CPF/CNPJ: validação (mod 11), normalização e formatação. CNPJ aceita o formato alfanumérico
// (IN RFB 2.229/2024, vigente a partir de julho/2026): 12 caracteres [A-Z0-9] + 2 dígitos verificadores,
// calculados sobre (charCode − 48) com pesos 5..2 / 6..2. Armazenar sempre 14 chars maiúsculos sem pontuação.
import type { TipoDocumento } from '../constants.js';

const PESOS_CNPJ_DV1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const PESOS_CNPJ_DV2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;

/** Remove pontuação e espaços e coloca em maiúsculas (CNPJ alfanumérico). */
export function normalizarDocumento(texto: string): string {
  if (typeof texto !== 'string') return '';
  return texto.replace(/[.\-/\s]/g, '').toUpperCase();
}

function todosIguais(texto: string): boolean {
  return texto.length > 0 && texto.split('').every((c) => c === texto[0]);
}

function dvMod11(soma: number): number {
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** Valida um CPF (aceita com ou sem máscara). Rejeita sequências repetidas. */
export function validarCPF(cpf: string): boolean {
  const doc = normalizarDocumento(cpf);
  if (!/^\d{11}$/.test(doc) || todosIguais(doc)) return false;
  const digitos = doc.split('').map(Number);

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += (digitos[i] ?? 0) * (10 - i);
  if (dvMod11(soma) !== digitos[9]) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += (digitos[i] ?? 0) * (11 - i);
  return dvMod11(soma) === digitos[10];
}

/** Valor de um caractere do CNPJ para o cálculo dos DVs: charCode − 48 (0-9 → 0-9, A-Z → 17-42). */
function valorCaractereCnpj(c: string): number {
  return c.charCodeAt(0) - 48;
}

/** Calcula os dois dígitos verificadores de uma base de 12 caracteres [A-Z0-9]. */
export function calcularDvCNPJ(base12: string): string {
  const base = normalizarDocumento(base12);
  if (!/^[A-Z0-9]{12}$/.test(base)) throw new RangeError(`Base de CNPJ inválida: ${base12}`);
  const valores = base.split('').map(valorCaractereCnpj);

  let soma = 0;
  for (let i = 0; i < 12; i++) soma += (valores[i] ?? 0) * (PESOS_CNPJ_DV1[i] ?? 0);
  const dv1 = dvMod11(soma);

  valores.push(dv1);
  soma = 0;
  for (let i = 0; i < 13; i++) soma += (valores[i] ?? 0) * (PESOS_CNPJ_DV2[i] ?? 0);
  const dv2 = dvMod11(soma);

  return `${dv1}${dv2}`;
}

/** Valida um CNPJ numérico ou alfanumérico (aceita com ou sem máscara). Rejeita sequências repetidas. */
export function validarCNPJ(cnpj: string): boolean {
  const doc = normalizarDocumento(cnpj);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(doc)) return false;
  if (todosIguais(doc.slice(0, 12))) return false;
  return calcularDvCNPJ(doc.slice(0, 12)) === doc.slice(12);
}

/** Tipo do documento quando válido; null quando inválido ou vazio. */
export function tipoDocumento(documento: string): TipoDocumento | null {
  const doc = normalizarDocumento(documento);
  if (doc.length === 11 && validarCPF(doc)) return 'cpf';
  if (doc.length === 14 && validarCNPJ(doc)) return 'cnpj';
  return null;
}

/** true para CPF ou CNPJ válidos. */
export function validarDocumento(documento: string): boolean {
  return tipoDocumento(documento) !== null;
}

/** 000.000.000-00 (não valida; formata o que tiver, parcial inclusive). */
export function formatarCPF(cpf: string): string {
  const d = normalizarDocumento(cpf).replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}

/** 00.000.000/0000-00 (aceita alfanumérico; formata parcial inclusive). */
export function formatarCNPJ(cnpj: string): string {
  const d = normalizarDocumento(cnpj)
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 14);
  return d
    .replace(/^([A-Z0-9]{2})([A-Z0-9])/, '$1.$2')
    .replace(/^([A-Z0-9]{2})\.([A-Z0-9]{3})([A-Z0-9])/, '$1.$2.$3')
    .replace(/^([A-Z0-9]{2})\.([A-Z0-9]{3})\.([A-Z0-9]{3})([A-Z0-9])/, '$1.$2.$3/$4')
    .replace(
      /^([A-Z0-9]{2})\.([A-Z0-9]{3})\.([A-Z0-9]{3})\/([A-Z0-9]{4})([A-Z0-9])/,
      '$1.$2.$3/$4-$5',
    );
}

/** Formata como CPF (11 dígitos) ou CNPJ (14 chars); outros tamanhos voltam normalizados. */
export function formatarDocumento(documento: string): string {
  const doc = normalizarDocumento(documento);
  if (doc.length === 11 && /^\d+$/.test(doc)) return formatarCPF(doc);
  if (doc.length === 14) return formatarCNPJ(doc);
  return doc;
}
