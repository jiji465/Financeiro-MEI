// Entrada monetária em centavos com digitação "calculadora": os dígitos entram pela direita
// (1 → 0,01; 12 → 0,12; 123 → 1,23). Valor null = campo vazio. Aceita colar "R$ 1.234,56".
import { type InputHTMLAttributes, type KeyboardEvent, useRef } from 'react';

import { formatCentavos, parseBRL } from '@/lib/format/money';
import { cn } from '@/lib/utils/cn';

import { inputClassName } from './input';

const MAX_DIGITOS = 15;

export interface MoneyInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'inputMode'
> {
  /** Valor em centavos ou null quando vazio. */
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  /** Permite alternar o sinal com a tecla "-". */
  allowNegative?: boolean;
  /** Oculta o prefixo "R$". */
  semPrefixo?: boolean;
  ref?: React.Ref<HTMLInputElement>;
}

export function formatarMoneyInput(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  const texto = formatCentavos(Math.abs(value));
  return value < 0 ? `-${texto}` : texto;
}

export function MoneyInput({
  value,
  onChange,
  allowNegative = false,
  semPrefixo = false,
  className,
  placeholder = '0,00',
  onKeyDown,
  onPaste,
  onFocus,
  ref,
  ...props
}: MoneyInputProps) {
  const internoRef = useRef<HTMLInputElement | null>(null);

  const setRefs = (el: HTMLInputElement | null) => {
    internoRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el;
  };

  const caretNoFim = () => {
    const el = internoRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      const fim = el.value.length;
      try {
        el.setSelectionRange(fim, fim);
      } catch {
        // inputs sem seleção (raro) — ignora
      }
    });
  };

  const emitirDigitos = (digitos: string, negativo: boolean) => {
    const limpos = digitos
      .replace(/\D/g, '')
      .replace(/^0+(?=\d)/, '')
      .slice(0, MAX_DIGITOS);
    if (limpos === '') {
      onChange(null);
      return;
    }
    const n = Number(limpos);
    onChange(negativo && n !== 0 ? -n : n);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const bruto = e.target.value;
    const negativo = allowNegative && bruto.trim().startsWith('-');
    emitirDigitos(bruto, negativo);
    caretNoFim();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === '-' && allowNegative) {
      e.preventDefault();
      if (value) onChange(-value);
      return;
    }
    if (e.key === '-' || e.key === '+' || e.key === '.' || e.key === ',') {
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    onPaste?.(e);
    if (e.defaultPrevented) return;
    e.preventDefault();
    const texto = e.clipboardData.getData('text');
    const centavos = parseBRL(texto);
    if (centavos === null) return;
    onChange(allowNegative ? centavos : Math.abs(centavos));
    caretNoFim();
  };

  const campo = (
    <input
      ref={setRefs}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={cn(inputClassName, 'text-right tabular-nums', !semPrefixo && 'pl-10', className)}
      value={formatarMoneyInput(value)}
      placeholder={placeholder}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onFocus={(e) => {
        onFocus?.(e);
        caretNoFim();
      }}
      {...props}
    />
  );

  if (semPrefixo) return campo;
  return (
    <div className="relative flex w-full items-center">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3 text-sm text-zinc-500 select-none"
      >
        R$
      </span>
      {campo}
    </div>
  );
}
