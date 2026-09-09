// Seletor de período com presets (Este mês, Mês passado, …) e intervalo personalizado.
import { useId } from 'react';

import {
  PERIODO_PRESET_LABELS,
  PERIODO_PRESETS,
  type Periodo,
  type PeriodoPreset,
  periodoPreset,
  presetDoPeriodo,
} from '@/lib/format/date';
import { cn } from '@/lib/utils/cn';

import { DateInput } from './date-input';
import { Label } from './label';
import { SimpleSelect } from './select';

export interface PeriodoValue extends Periodo {
  preset?: PeriodoPreset;
}

export interface PeriodoSelectProps {
  value: PeriodoValue;
  onChange: (value: Required<PeriodoValue>) => void;
  className?: string;
  /** Presets disponíveis (padrão: todos). */
  presets?: readonly PeriodoPreset[];
  'aria-label'?: string;
}

const OPCOES = PERIODO_PRESETS.map((p) => ({ value: p, label: PERIODO_PRESET_LABELS[p] }));

export function PeriodoSelect({
  value,
  onChange,
  className,
  presets,
  'aria-label': ariaLabel = 'Período',
}: PeriodoSelectProps) {
  const id = useId();
  const preset = value.preset ?? presetDoPeriodo(value);
  const opcoes = presets ? OPCOES.filter((o) => presets.includes(o.value)) : OPCOES;

  const escolherPreset = (novo: PeriodoPreset | '') => {
    if (!novo) return;
    if (novo === 'personalizado') {
      onChange({ de: value.de, ate: value.ate, preset: 'personalizado' });
      return;
    }
    onChange({ ...periodoPreset(novo), preset: novo });
  };

  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:items-end', className)}>
      <div className="w-full sm:w-48">
        <SimpleSelect<PeriodoPreset>
          id={`${id}-preset`}
          aria-label={ariaLabel}
          value={preset}
          onValueChange={escolherPreset}
          options={opcoes}
        />
      </div>
      {preset === 'personalizado' ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1">
            <Label htmlFor={`${id}-de`} className="text-xs text-zinc-500">
              De
            </Label>
            <DateInput
              id={`${id}-de`}
              value={value.de}
              max={value.ate}
              onChange={(de) => de && onChange({ de, ate: value.ate, preset: 'personalizado' })}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor={`${id}-ate`} className="text-xs text-zinc-500">
              Até
            </Label>
            <DateInput
              id={`${id}-ate`}
              value={value.ate}
              min={value.de}
              onChange={(ate) => ate && onChange({ de: value.de, ate, preset: 'personalizado' })}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
