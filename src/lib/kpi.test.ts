import { describe, expect, it } from 'vitest';
import { availability, mttr, mtbf } from './kpi';
import type { Failure } from './types';

const f = (inicio: string, fin: string | null): Failure => ({
  id: 'x', numero: 1, asset_id: 'a', reportado_por: 'u', severidad: 'urgente', detiene_produccion: true,
  inicio_detencion: inicio, liberacion: fin, descripcion: '', causa_inmediata: '', extra: {},
  estado: 'resuelto', fotos: [], creado: inicio,
  fecha_inicio_solucion: null, nota_status: '', nota_solucion: '', encargado_id: null,
});

describe('kpi', () => {
  const fs = [f('2026-01-01T00:00:00Z', '2026-01-01T02:00:00Z'), f('2026-01-02T00:00:00Z', '2026-01-02T04:00:00Z')];
  it('MTTR promedia horas de reparación', () => expect(mttr(fs)).toBe(3));
  it('MTBF = (periodo − detención) / fallas', () => {
    const v = mtbf(fs, new Date('2026-01-01T00:00:00Z'), new Date('2026-01-03T00:00:00Z'));
    expect(v).toBe((48 - 6) / 2);
  });
  it('disponibilidad', () => expect(availability(21, 3)).toBe(87.5));
  it('sin datos devuelve null', () => expect(mttr([])).toBeNull());
});
