// "Hoje" de negócio (America/Sao_Paulo), injetável para testes com relógio falso.
import { hojeSP, type IsoDate } from '@meifin/shared';

export type HojeFn = () => IsoDate;

/** Implementação padrão: data civil atual em São Paulo. */
export const hoje: HojeFn = () => hojeSP();

/** Cria um relógio fixo (testes) ou baseado em um instante específico. */
export function criarHoje(fixo: IsoDate | Date): HojeFn {
  return typeof fixo === 'string' ? () => fixo : () => hojeSP(fixo);
}
