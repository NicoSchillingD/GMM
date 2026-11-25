import type { Failure } from './types';

const H = 3_600_000;
const hours = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / H;

/** Detención de una falla en horas (si sigue abierta cuenta hasta `now`). */
export function downtimeHours(f: Failure, now = new Date()): number {
  if (!f.detiene_produccion || !f.inicio_detencion) return 0;
  return Math.max(0, hours(f.inicio_detencion, f.liberacion ?? now.toISOString()));
}

/** MTTR: promedio de horas de reparación de fallas con detención ya liberadas. */
export function mttr(fs: Failure[]): number | null {
  const done = fs.filter((f) => f.detiene_produccion && f.inicio_detencion && f.liberacion);
  if (!done.length) return null;
  return done.reduce((s, f) => s + hours(f.inicio_detencion!, f.liberacion!), 0) / done.length;
}

/** Mínimo de fallas con detención que debe tener un equipo para calcular su MTBF. */
export const MIN_FAILURES_MTBF = 2;

/**
 * MTBF: horas operativas del periodo (menos detención) divididas por el nº de fallas con detención.
 * Solo cuentan los equipos con al menos 2 fallas con detención; si ninguno llega a 2, no hay MTBF (null).
 * Con varios equipos, es el agregado de los que cumplen el mínimo.
 */
export function mtbf(fs: Failure[], from: Date, to: Date, now = new Date()): number | null {
  const byAsset = new Map<string, Failure[]>();
  for (const f of fs) if (f.detiene_produccion && f.inicio_detencion) byAsset.set(f.asset_id, [...(byAsset.get(f.asset_id) ?? []), f]);
  const eligible = [...byAsset.values()].filter((x) => x.length >= MIN_FAILURES_MTBF);
  if (!eligible.length) return null;
  const period = (to.getTime() - from.getTime()) / H;
  const total = period * eligible.length;
  const stops = eligible.flat();
  const down = stops.reduce((s, f) => s + downtimeHours(f, now), 0);
  return Math.max(0, total - down) / stops.length;
}

/** Disponibilidad = MTBF / (MTBF + MTTR). */
export function availability(mtbfH: number | null, mttrH: number | null): number | null {
  if (mtbfH == null || mttrH == null) return null;
  return (mtbfH / (mtbfH + mttrH)) * 100;
}
