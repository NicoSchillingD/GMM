import { ALWAYS, scheduleForAreaName, type Schedule } from '../config/schedules';
import type { Area, Asset, Failure } from './types';

const H = 3_600_000;

/** Horas de trabajo (según el horario) entre dos instantes. Fuera del horario el reloj no corre. */
export function workingHours(s: Schedule, from: Date, to: Date): number {
  if (!(to > from)) return 0;
  let ms = 0;
  const day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  while (day < to) {
    for (const [a, b] of s[day.getDay()] ?? []) {
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, a);
      const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, b);
      const lo = start > from ? start : from, hi = end < to ? end : to;
      if (hi > lo) ms += hi.getTime() - lo.getTime();
    }
    day.setDate(day.getDate() + 1);
  }
  return ms / H;
}

/** Área de un activo; los componentes heredan la de su equipo. */
export function areaOfAsset(assetId: string, assets: Asset[]): string | null {
  const byId = new Map(assets.map((a) => [a.id, a]));
  for (let cur = byId.get(assetId), hops = 0; cur && hops < 20; cur = cur.parent_id ? byId.get(cur.parent_id) : undefined, hops++) if (cur.area_id) return cur.area_id;
  return null;
}

export type SchedOf = (f: Pick<Failure, 'asset_id'>) => Schedule;

/** Horario aplicable a una falla según el área de su activo. */
export function makeSchedOf(assets: Asset[], areas: Area[]): SchedOf {
  const names = new Map(areas.map((a) => [a.id, a.nombre]));
  return (f) => scheduleForAreaName(names.get(areaOfAsset(f.asset_id, assets) ?? ''));
}

export const calendar: SchedOf = () => ALWAYS;

/** Tiempo de respuesta de Mantención: horas hábiles entre el reporte y el inicio de la solución (o hasta ahora si aún no parte). */
export function responseHours(f: Failure, s: Schedule, now = new Date()): number {
  return workingHours(s, new Date(f.creado), f.fecha_inicio_solucion ? new Date(f.fecha_inicio_solucion) : now);
}

/** Promedio de respuesta de los casos que ya partieron; null si no hay ninguno. */
export function avgResponse(fs: Failure[], schedOf: SchedOf): number | null {
  const done = fs.filter((f) => f.fecha_inicio_solucion);
  if (!done.length) return null;
  return done.reduce((sum, f) => sum + responseHours(f, schedOf(f)), 0) / done.length;
}
