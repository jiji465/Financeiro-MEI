// Input com máscara brasileira. O valor armazenado é sempre "cru" (só dígitos; CNPJ pode ter letras).
import { type InputHTMLAttributes } from 'react';

import { maskCEP } from '@/lib/format/cep';
import {
  maskCNPJ,
  maskCPF,
  maskCPFouCNPJ,
  normalizarCNPJ,
  onlyAlnum,
  onlyDigits,
} from '@/lib/format/documento';
import { maskTelefone } from '@/lib/format/telefone';
import { cn } from '@/lib/utils/cn';

import { inputClassName } from './input';

export type Mascara = 'cpf' | 'cnpj' | 'cpfCnpj' | 'telefone' | 'cep';

interface DefinicaoMascara {
  aplicar: (bruto: string) => string;
  limpar: (texto: string) => string;
  max: number;
  placeholder: string;
  inputMode: 'numeric' | 'text';
}

export const MASCARAS: Record<Mascara, DefinicaoMascara> = {
  cpf: {
    aplicar: maskCPF,
    limpar: (t) => onlyDigits(t).slice(0, 11),
    max: 11,
    placeholder: '000.000.000-00',
    inputMode: 'numeric',
  },
  cnpj: {
    aplicar: maskCNPJ,
    limpar: normalizarCNPJ,
    max: 14,
    placeholder: '00.000.000/0000-00',
    inputMode: 'text',
  },
  cpfCnpj: {
    aplicar: maskCPFouCNPJ,
    limpar: (t) => onlyAlnum(t).slice(0, 14),
    max: 14,
    placeholder: 'CPF ou CNPJ',
    inputMode: 'text',
  },
  telefone: {
    aplicar: maskTelefone,
    limpar: (t) => onlyDigits(t).slice(0, 11),
    max: 11,
    placeholder: '(00) 00000-0000',
    inputMode: 'numeric',
  },
  cep: {
    aplicar: maskCEP,
    limpar: (t) => onlyDigits(t).slice(0, 8),
    max: 8,
    placeholder: '00000-000',
    inputMode: 'numeric',
  },
};

export interface MaskedInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'inputMode'
> {
  mask: Mascara;
  /** Valor cru (sem máscara). */
  value: string | null | undefined;
  onChange: (valorCru: string) => void;
  ref?: React.Ref<HTMLInputElement>;
}

export function MaskedInput({
  mask,
  value,
  onChange,
  className,
  placeholder,
  ref,
  ...props
}: MaskedInputProps) {
  const def = MASCARAS[mask];
  return (
    <input
      ref={ref}
      type="text"
      inputMode={def.inputMode}
      autoComplete="off"
      autoCapitalize={def.inputMode === 'text' ? 'characters' : undefined}
      className={cn(inputClassName, 'tabular-nums', className)}
      value={def.aplicar(value ?? '')}
      placeholder={placeholder ?? def.placeholder}
      onChange={(e) => onChange(def.limpar(e.target.value))}
      {...props}
    />
  );
}
