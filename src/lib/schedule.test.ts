import { describe, expect, it } from 'vitest';
import { PVC, STANDARD } from '../config/schedules';
import { avgResponse, makeSchedOf, responseHours, workingHours } from './schedule';
import { mtbf, mttr } from './kpi';
import type { Area, Asset, Failure } from './types';

// 2026-01-05 es lunes. Las fechas se crean en hora local, como las usa la App.
const d = (day: number, h: number, m = 0) => new Date(2026, 0, day, h, m);
const [LU, MA, VI, SA, DO, LU2] = [5, 6, 9, 10, 11, 12];

describe('horas hábiles', () => {
  it('dentro de un mismo día', () => expect(workingHours(STANDARD, d(LU, 8), d(LU, 10))).toBe(2));
  it('solo cuenta el horario: de noche el reloj no corre', () => expect(workingHours(STANDARD, d(LU, 17), d(MA, 8, 45))).toBe(0.5 + 1));
  it('el viernes cierra a las 13:20 y el fin de semana no cuenta', () => expect(workingHours(STANDARD, d(VI, 13), d(LU2, 8, 45))).toBeCloseTo(20 / 60 + 1, 6));
  it('semana completa estándar: 4 × 9:45 + 5:35', () => expect(workingHours(STANDARD, d(LU, 0), d(LU2, 0))).toBeCloseTo(4 * 9.75 + 5 + 35 / 60, 6));
  it('PVC trabaja hasta las 22:00 y los sábados', () => {
    expect(workingHours(PVC, d(VI, 21), d(SA, 9, 30))).toBe(2);
    expect(workingHours(PVC, d(SA, 17), d(LU2, 8, 45))).toBe(2);
    expect(workingHours(PVC, d(LU, 0), d(LU2, 0))).toBeCloseTo(5 * 14.25 + 9.5, 6);
  });
  it('domingo y rangos inválidos no suman', () => { expect(workingHours(PVC, d(DO, 0), d(DO, 23))).toBe(0); expect(workingHours(STANDARD, d(MA, 0), d(LU, 0))).toBe(0); });
});

const area = (id: string, nombre: string): Area => ({ id, nombre });
const asset = (id: string, area_id: string | null, parent_id: string | null = null): Asset => ({ id, parent_id, area_id, tag: id, tipo: '', marca: '', modelo: '', serie: '', anio_fab: null, estado: 'operativo', criticidad: '', diagnostico: '', es_componente: !!parent_id });
const areas = [area('a1', 'Aluminio'), area('a2', 'PVC')];
const assets = [asset('m1', 'a1'), asset('m2', 'a2'), asset('c2', null, 'm2')];
const schedOf = makeSchedOf(assets, areas);
const fail = (asset_id: string, ini: Date, fin: Date | null, extra: Partial<Failure> = {}): Failure => ({
  id: Math.random() + '', numero: 1, tipo: 'falla', asset_id, reportado_por: 'u', severidad: 'urgente', detiene_produccion: true,
  inicio_detencion: ini.toISOString(), liberacion: fin?.toISOString() ?? null, descripcion: '', causa_inmediata: '', extra: {}, estado: 'resuelto', fotos: [],
  creado: ini.toISOString(), fecha_inicio_solucion: null, nota_status: '', nota_solucion: '', encargado_id: null, ...extra,
});

describe('MTTR, MTBF y respuesta con horario', () => {
  it('el horario depende del área (los componentes heredan la del equipo)', () => {
    expect(schedOf({ asset_id: 'm1' })).toBe(STANDARD); expect(schedOf({ asset_id: 'm2' })).toBe(PVC); expect(schedOf({ asset_id: 'c2' })).toBe(PVC);
  });
  it('MTTR cuenta solo horas hábiles: falla el lunes 17:00 y se repara el martes 08:45 = 1,5 h (no 15,75 h)', () => {
    expect(mttr([fail('m1', d(LU, 17), d(MA, 8, 45))], schedOf)).toBe(1.5);
    expect(mttr([fail('m2', d(LU, 17), d(MA, 8, 45))], schedOf)).toBe(5 + 1); // en PVC trabajan hasta las 22:00
  });
  it('MTBF usa las horas hábiles del periodo menos la detención hábil', () => {
    const fs = [fail('m1', d(LU, 8), d(LU, 10)), fail('m1', d(MA, 8), d(MA, 12))];
    const v = mtbf(fs, d(LU, 0), d(LU2, 0), d(LU2, 0), schedOf)!;
    expect(v).toBeCloseTo((4 * 9.75 + 5 + 35 / 60 - 6) / 2, 6);
  });
  it('tiempo de respuesta: reporte el viernes 12:00, inicio el lunes 08:45 = 1 h 20 min + 1 h', () => {
    const f = fail('m1', d(VI, 12), null, { fecha_inicio_solucion: d(LU2, 8, 45).toISOString() });
    expect(responseHours(f, STANDARD)).toBeCloseTo(80 / 60 + 1, 6);
    expect(avgResponse([f, fail('m1', d(LU, 8), null)], schedOf)).toBeCloseTo(80 / 60 + 1, 6); // el que aún no parte no entra al promedio
  });
});
