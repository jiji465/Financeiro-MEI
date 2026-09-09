// Combobox pesquisável (cmdk dentro de Popover) com opção de criar um novo item.
import { Command as CommandPrimitive } from 'cmdk';
import { Check, ChevronsUpDown, LoaderCircle, Plus, X } from 'lucide-react';
import { useState } from 'react';

import { normalizarBusca } from '@/lib/format/texto';
import { cn } from '@/lib/utils/cn';

import { Popover, PopoverContent, PopoverTrigger } from './popover';

export interface ComboboxOption {
  value: string;
  label: string;
  descricao?: string;
  /** Termos extras para a busca (ex.: CNPJ, apelido). */
  keywords?: string[];
  disabled?: boolean;
}

export interface ComboboxProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  options: readonly ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Quando informado, mostra "Criar 'X'" para texto sem correspondência. */
  onCreate?: (texto: string) => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  /** Botão para limpar a seleção. */
  clearable?: boolean;
  id?: string;
  className?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  'aria-label'?: string;
  onBlur?: () => void;
}

function filtro(value: string, search: string, keywords?: string[]): number {
  const alvo = normalizarBusca([value, ...(keywords ?? [])].join(' '));
  const termos = normalizarBusca(search).split(/\s+/).filter(Boolean);
  return termos.every((t) => alvo.includes(t)) ? 1 : 0;
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Selecione…',
  searchPlaceholder = 'Buscar…',
  emptyText = 'Nenhum resultado encontrado.',
  onCreate,
  loading,
  disabled,
  clearable,
  id,
  className,
  onBlur,
  ...aria
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const [criando, setCriando] = useState(false);
  const selecionada = options.find((o) => o.value === value);
  const buscaLimpa = busca.trim();
  const existeExata = options.some((o) => normalizarBusca(o.label) === normalizarBusca(buscaLimpa));

  const criar = async () => {
    if (!onCreate || !buscaLimpa) return;
    try {
      setCriando(true);
      await onCreate(buscaLimpa);
      setBusca('');
      setOpen(false);
    } finally {
      setCriando(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(aberto) => {
        setOpen(aberto);
        if (!aberto) {
          setBusca('');
          onBlur?.();
        }
      }}
    >
      <div className={cn('relative flex w-full items-center', className)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            disabled={disabled}
            className={cn(
              'flex h-11 w-full items-center justify-between gap-2 rounded-md border border-borda bg-superficie px-3 py-2 text-left text-base shadow-xs transition-colors focus-visible:border-primary-500 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary-500/40 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-perigo-500 md:h-10 md:text-sm',
              !selecionada && 'text-zinc-400',
              clearable && selecionada && 'pr-16',
            )}
            {...aria}
          >
            <span className="truncate">{selecionada ? selecionada.label : placeholder}</span>
            {loading ? (
              <LoaderCircle
                className="size-4 shrink-0 animate-spin text-zinc-400"
                aria-hidden="true"
              />
            ) : (
              <ChevronsUpDown className="size-4 shrink-0 text-zinc-500" aria-hidden="true" />
            )}
          </button>
        </PopoverTrigger>
        {clearable && selecionada && !disabled ? (
          <button
            type="button"
            aria-label="Limpar seleção"
            className="absolute right-9 flex size-7 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-texto"
            onClick={() => onChange(null)}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-56 p-0" align="start">
        <CommandPrimitive filter={filtro} loop className="flex flex-col">
          <div className="flex items-center gap-2 border-b border-borda px-3">
            <CommandPrimitive.Input
              value={busca}
              onValueChange={setBusca}
              placeholder={searchPlaceholder}
              className="h-11 w-full bg-transparent text-base outline-none placeholder:text-zinc-400 md:h-10 md:text-sm"
            />
          </div>
          <CommandPrimitive.List className="max-h-64 overflow-y-auto p-1">
            {loading ? (
              <div className="px-3 py-4 text-center text-sm text-zinc-500">Carregando…</div>
            ) : (
              <CommandPrimitive.Empty className="px-3 py-4 text-center text-sm text-zinc-500">
                {emptyText}
              </CommandPrimitive.Empty>
            )}
            {options.map((o) => (
              <CommandPrimitive.Item
                key={o.value}
                value={o.label}
                keywords={o.keywords}
                disabled={o.disabled}
                onSelect={() => {
                  onChange(o.value === value ? (clearable ? null : o.value) : o.value);
                  setOpen(false);
                }}
                className="relative flex min-h-10 cursor-default items-center gap-2 rounded-md px-2 py-2 text-sm outline-none select-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-zinc-100"
              >
                <Check
                  className={cn('size-4 shrink-0', o.value === value ? 'opacity-100' : 'opacity-0')}
                  aria-hidden="true"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{o.label}</span>
                  {o.descricao ? (
                    <span className="truncate text-xs text-zinc-500">{o.descricao}</span>
                  ) : null}
                </span>
              </CommandPrimitive.Item>
            ))}
            {onCreate && buscaLimpa && !existeExata ? (
              <CommandPrimitive.Item
                value={`__criar__ ${buscaLimpa}`}
                forceMount
                onSelect={() => void criar()}
                disabled={criando}
                className="relative mt-1 flex min-h-10 cursor-default items-center gap-2 rounded-md border-t border-borda px-2 py-2 text-sm text-primary-700 outline-none select-none data-[selected=true]:bg-primary-50"
              >
                {criando ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="size-4" aria-hidden="true" />
                )}
                Criar “{buscaLimpa}”
              </CommandPrimitive.Item>
            ) : null}
          </CommandPrimitive.List>
        </CommandPrimitive>
      </PopoverContent>
    </Popover>
  );
}
