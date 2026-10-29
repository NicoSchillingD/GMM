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

/** MTBF: horas operativas en el periodo (menos detención) divididas por nº de fallas con detención. */
export function mtbf(fs: Failure[], from: Date, to: Date, assets = 1, now = new Date()): number | null {
  const stops = fs.filter((f) => f.detiene_produccion && f.inicio_detencion);
  if (!stops.length) return null;
  const total = ((to.getTime() - from.getTime()) / H) * assets;
  const down = stops.reduce((s, f) => s + downtimeHours(f, now), 0);
  return Math.max(0, total - down) / stops.length;
}

/** Disponibilidad = MTBF / (MTBF + MTTR). */
export function availability(mtbfH: number | null, mttrH: number | null): number | null {
  if (mtbfH == null || mttrH == null) return null;
  return (mtbfH / (mtbfH + mttrH)) * 100;
}
