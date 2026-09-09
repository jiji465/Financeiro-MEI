// "Hoje" de negócio (America/Sao_Paulo), injetável para testes com relógio falso.
// A instância Fastify expõe app.hoje (BuildAppOptions.hoje sobrescreve nos testes).
import { hojeSP, type IsoDate } from '@meifin/shared';

export type HojeFn = () => IsoDate;

/** Implementação padrão: data civil atual em São Paulo. */
export const hoje: HojeFn = () => hojeSP();

/** Cria um relógio fixo (testes) ou baseado em um instante específico. */
export function criarHoje(fixo: IsoDate | Date): HojeFn {
  return typeof fixo === 'string' ? () => fixo : () => hojeSP(fixo);
}

/** Instante atual em ISO 8601 (timestamps do banco em modo string). */
export function agoraIso(): string {
  return new Date().toISOString();
}

/** Instante daqui a N segundos em ISO 8601. */
export function daquiA(segundos: number): string {
  return new Date(Date.now() + segundos * 1000).toISOString();
}

/**
 * Normaliza um timestamptz vindo do banco ('2026-09-09 12:00:00.123+00' no PGlite/pg) para
 * ISO 8601 UTC. Devolve o valor original se não for interpretável.
 */
export function isoTimestamp(valor: string | Date | null | undefined): string | null {
  if (valor === null || valor === undefined) return null;
  // Postgres devolve '2026-09-09 12:00:00.123+00' (ou '-03'); o Date do V8 exige 'T' e '+00:00'.
  const normalizado =
    valor instanceof Date
      ? valor
      : new Date(valor.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00'));
  return Number.isNaN(normalizado.getTime()) ? String(valor) : normalizado.toISOString();
}

/** true se o instante ISO/timestamptz já passou. */
export function expirou(valor: string | Date): boolean {
  const iso = isoTimestamp(valor);
  return iso === null || new Date(iso).getTime() <= Date.now();
}
