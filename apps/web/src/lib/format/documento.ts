// CPF/CNPJ: máscaras e validação. CNPJ aceita o formato alfanumérico (regra de 2026):
// 12 caracteres [A-Z0-9] + 2 dígitos verificadores calculados com (charCode − 48).

export function onlyDigits(texto: string | null | undefined): string {
  return (texto ?? '').replace(/\D/g, '');
}

/** Mantém apenas letras e dígitos, em maiúsculas (CNPJ alfanumérico). */
export function onlyAlnum(texto: string | null | undefined): string {
  return (texto ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** CNPJ normalizado para armazenar: 14 caracteres maiúsculos sem pontuação. */
export function normalizarCNPJ(texto: string | null | undefined): string {
  return onlyAlnum(texto).slice(0, 14);
}

/** "52998224725" → "529.982.247-25" (aplica parcialmente enquanto digita). */
export function maskCPF(texto: string | null | undefined): string {
  const d = onlyDigits(texto).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}

/** "11222333000181" → "11.222.333/0001-81"; aceita alfanumérico ("12ABC34501DE35"). */
export function maskCNPJ(texto: string | null | undefined): string {
  const c = normalizarCNPJ(texto);
  return c
    .replace(/^([A-Z0-9]{2})([A-Z0-9])/, '$1.$2')
    .replace(/^([A-Z0-9]{2})\.([A-Z0-9]{3})([A-Z0-9])/, '$1.$2.$3')
    .replace(/^([A-Z0-9]{2})\.([A-Z0-9]{3})\.([A-Z0-9]{3})([A-Z0-9])/, '$1.$2.$3/$4')
    .replace(
      /^([A-Z0-9]{2})\.([A-Z0-9]{3})\.([A-Z0-9]{3})\/([A-Z0-9]{4})([A-Z0-9])/,
      '$1.$2.$3/$4-$5',
    );
}

/** CPF até 11 dígitos numéricos; a partir do 12º caractere (ou se houver letra) vira CNPJ. */
export function maskCPFouCNPJ(texto: string | null | undefined): string {
  const alnum = onlyAlnum(texto);
  const temLetra = /[A-Z]/.test(alnum);
  if (!temLetra && alnum.length <= 11) return maskCPF(alnum);
  return maskCNPJ(alnum);
}

function todosIguais(texto: string): boolean {
  return texto.length > 0 && texto.split('').every((c) => c === texto[0]);
}

function digitoMod11(valores: number[], pesos: number[]): number {
  let soma = 0;
  for (let i = 0; i < pesos.length; i++) {
    soma += (valores[i] ?? 0) * (pesos[i] ?? 0);
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function isValidCPF(texto: string | null | undefined): boolean {
  const cpf = onlyDigits(texto);
  if (cpf.length !== 11 || todosIguais(cpf)) return false;
  const numeros = cpf.split('').map(Number);
  const dv1 = digitoMod11(numeros.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (dv1 !== numeros[9]) return false;
  const dv2 = digitoMod11(numeros.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return dv2 === numeros[10];
}

const PESOS_CNPJ_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_CNPJ_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/** Valida CNPJ numérico ou alfanumérico (12 chars [A-Z0-9] + 2 dígitos). */
export function isValidCNPJ(texto: string | null | undefined): boolean {
  const cnpj = normalizarCNPJ(texto);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj) || todosIguais(cnpj)) return false;
  const valores = cnpj.split('').map((c) => c.charCodeAt(0) - 48);
  const dv1 = digitoMod11(valores.slice(0, 12), PESOS_CNPJ_1);
  if (dv1 !== Number(cnpj[12])) return false;
  const dv2 = digitoMod11(valores.slice(0, 13), PESOS_CNPJ_2);
  return dv2 === Number(cnpj[13]);
}

export function isValidCPFouCNPJ(texto: string | null | undefined): boolean {
  const alnum = onlyAlnum(texto);
  if (!/[A-Z]/.test(alnum) && alnum.length === 11) return isValidCPF(alnum);
  return isValidCNPJ(alnum);
}

export type TipoDocumento = 'cpf' | 'cnpj';

/** Identifica o tipo pelo tamanho/conteúdo (null se não parece nenhum dos dois). */
export function tipoDocumento(texto: string | null | undefined): TipoDocumento | null {
  const alnum = onlyAlnum(texto);
  if (alnum.length === 11 && /^\d+$/.test(alnum)) return 'cpf';
  if (alnum.length === 14) return 'cnpj';
  return null;
}

/** Formata para exibição; devolve o texto original se não for CPF/CNPJ completo. */
export function formatDocumento(texto: string | null | undefined): string {
  const tipo = tipoDocumento(texto);
  if (tipo === 'cpf') return maskCPF(texto);
  if (tipo === 'cnpj') return maskCNPJ(texto);
  return texto ?? '';
}
