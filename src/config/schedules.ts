/**
 * Horarios de trabajo por área. Son los que cuentan para el tiempo de respuesta de Mantención, el MTTR y el MTBF:
 * fuera de estos tramos el reloj no corre (noches, fines de semana). Hora local de Chile; no considera feriados.
 */
export type Interval = [number, number]; // minutos desde las 00:00
export type Schedule = Record<number, Interval[]>; // 0 = domingo … 6 = sábado

const hm = (h: number, m = 0) => h * 60 + m;

/** Todas las áreas, salvo PVC: lunes a jueves 07:45–17:30 y viernes 07:45–13:20. */
export const STANDARD: Schedule = {
  1: [[hm(7, 45), hm(17, 30)]], 2: [[hm(7, 45), hm(17, 30)]], 3: [[hm(7, 45), hm(17, 30)]], 4: [[hm(7, 45), hm(17, 30)]],
  5: [[hm(7, 45), hm(13, 20)]],
};

/** PVC: lunes a viernes 07:45–22:00 y sábados 08:30–18:00. */
export const PVC: Schedule = {
  1: [[hm(7, 45), hm(22)]], 2: [[hm(7, 45), hm(22)]], 3: [[hm(7, 45), hm(22)]], 4: [[hm(7, 45), hm(22)]], 5: [[hm(7, 45), hm(22)]],
  6: [[hm(8, 30), hm(18)]],
};

/** Reloj corrido (24 × 7): sirve de valor por defecto cuando no se indica horario. */
export const ALWAYS: Schedule = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, [[0, 1440]]]));

export const scheduleForAreaName = (name?: string | null): Schedule => (name?.trim().toLowerCase() === 'pvc' ? PVC : STANDARD);

const t = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const SCHEDULE_TEXT = 'Horario hábil: lunes a jueves 07:45–17:30 y viernes 07:45–13:20 (PVC: lunes a viernes 07:45–22:00 y sábados 08:30–18:00).';
export const intervalText = (i: Interval) => `${t(i[0])}–${t(i[1])}`;
