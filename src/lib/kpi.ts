import type { Failure } from './types';
import { calendar, workingHours, type SchedOf } from './schedule';
import type { Schedule } from '../config/schedules';

const H = 3_600_000;
const hours = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / H;

/** Detención de una falla en horas (si sigue abierta cuenta hasta `now`). Con horario, cuenta solo las horas hábiles. */
export function downtimeHours(f: Failure, now = new Date(), schedule?: Schedule): number {
  if (!f.detiene_produccion || !f.inicio_detencion) return 0;
  if (schedule) return workingHours(schedule, new Date(f.inicio_detencion), f.liberacion ? new Date(f.liberacion) : now);
  return Math.max(0, hours(f.inicio_detencion, f.liberacion ?? now.toISOString()));
}

/** MTTR: promedio de horas de reparación de fallas con detención ya liberadas (horas hábiles del área según `schedOf`). */
export function mttr(fs: Failure[], schedOf: SchedOf = calendar): number | null {
  const done = fs.filter((f) => f.detiene_produccion && f.inicio_detencion && f.liberacion);
  if (!done.length) return null;
  return done.reduce((s, f) => s + workingHours(schedOf(f), new Date(f.inicio_detencion!), new Date(f.liberacion!)), 0) / done.length;
}

/** Mínimo de fallas con detención que debe tener un equipo para calcular su MTBF. */
export const MIN_FAILURES_MTBF = 2;

/**
 * MTBF: horas operativas del periodo (menos detención) divididas por el nº de fallas con detención.
 * Solo cuentan los equipos con al menos 2 fallas con detención; si ninguno llega a 2, no hay MTBF (null).
 * Con varios equipos, es el agregado de los que cumplen el mínimo.
 */
export function mtbf(fs: Failure[], from: Date, to: Date, now = new Date(), schedOf: SchedOf = calendar): number | null {
  const byAsset = new Map<string, Failure[]>();
  for (const f of fs) if (f.detiene_produccion && f.inicio_detencion) byAsset.set(f.asset_id, [...(byAsset.get(f.asset_id) ?? []), f]);
  const eligible = [...byAsset.values()].filter((x) => x.length >= MIN_FAILURES_MTBF);
  if (!eligible.length) return null;
  // Horas hábiles del periodo de cada equipo (según el horario de su área), menos sus horas hábiles de detención.
  const total = eligible.reduce((sum, x) => sum + workingHours(schedOf(x[0]), from, to), 0);
  const stops = eligible.flat();
  const down = stops.reduce((sum, f) => sum + downtimeHours(f, now, schedOf(f)), 0);
  return Math.max(0, total - down) / stops.length;
}

/** Disponibilidad = MTBF / (MTBF + MTTR). */
export function availability(mtbfH: number | null, mttrH: number | null): number | null {
  if (mtbfH == null || mttrH == null) return null;
  return (mtbfH / (mtbfH + mttrH)) * 100;
}
