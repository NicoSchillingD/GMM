import { describe, expect, it } from 'vitest';
import { availability, mttr, mtbf } from './kpi';
import type { Failure } from './types';

const f = (inicio: string, fin: string | null): Failure => ({
  id: 'x', numero: 1, tipo: 'falla', asset_id: 'a', reportado_por: 'u', severidad: 'urgente', detiene_produccion: true,
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
  it('MTBF exige al menos 2 fallas con detención en el equipo', () => {
    const [from, to] = [new Date('2026-01-01T00:00:00Z'), new Date('2026-01-03T00:00:00Z')];
    expect(mtbf([fs[0]], from, to)).toBeNull();
    expect(mtbf([], from, to)).toBeNull();
  });
  it('MTBF con varios equipos solo considera los que tienen 2 o más fallas', () => {
    const [from, to] = [new Date('2026-01-01T00:00:00Z'), new Date('2026-01-03T00:00:00Z')];
    const otro = { ...f('2026-01-02T10:00:00Z', '2026-01-02T12:00:00Z'), id: 'y', asset_id: 'b' };
    expect(mtbf([...fs, otro], from, to)).toBe((48 - 6) / 2); // el equipo "b" (1 falla) no entra
  });
  it('las fallas sin detención no cuentan para el MTBF', () => {
    const [from, to] = [new Date('2026-01-01T00:00:00Z'), new Date('2026-01-03T00:00:00Z')];
    const sin = { ...fs[1], detiene_produccion: false, inicio_detencion: null, liberacion: null };
    expect(mtbf([fs[0], sin], from, to)).toBeNull();
  });
  it('disponibilidad', () => expect(availability(21, 3)).toBe(87.5));
  it('sin datos devuelve null', () => expect(mttr([])).toBeNull());
});
