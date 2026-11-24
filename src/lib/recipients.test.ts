import { describe, expect, it } from 'vitest';
import { areaOwners, noticeAreaAssigned, noticeCaseAssigned, noticeFailureCreated, noticeStatusChanged, type PAsset, type PAssignment, type PFailure, type PProfile } from '../../supabase/functions/send-push/recipients.ts';

const profiles: PProfile[] = [
  { id: 'm1', rol: 'mantenimiento' }, { id: 'm2', rol: 'mantenimiento' }, { id: 'adm', rol: 'admin' },
  { id: 's1', rol: 'supervisor' }, { id: 's2', rol: 'supervisor' }, { id: 's3', rol: 'supervisor' },
];
const assets: PAsset[] = [{ id: 'maq', parent_id: null, area_id: 'ar1', tag: 'AL-1', tipo: 'Cortadora', marca: 'Emmegi' }, { id: 'comp', parent_id: 'maq', area_id: null, tag: 'AL-1-M', tipo: 'Motor' }, { id: 'otra', parent_id: null, area_id: 'ar2', tag: 'CT-9' }];
const assignments: PAssignment[] = [{ profile_id: 's1', asset_id: null, area_id: 'ar1' }, { profile_id: 's2', asset_id: 'maq', area_id: null }, { profile_id: 's3', asset_id: null, area_id: 'ar2' }];
const f = (o: Partial<PFailure> = {}): PFailure => ({ id: 'f1', numero: 7, tipo: 'falla', asset_id: 'maq', severidad: 'informativo', descripcion: 'No reconoce el espesor', encargado_id: null, ...o });
const ctx = (actor: string) => ({ profiles, assets, assignments, actor });

describe('destinatarios de avisos', () => {
  it('responsables: por área, por equipo asignado y por componente (hereda del padre)', () => {
    expect(areaOwners('maq', assets, assignments).sort()).toEqual(['s1', 's2']);
    expect(areaOwners('comp', assets, assignments).sort()).toEqual(['s1', 's2']);
    expect(areaOwners('otra', assets, assignments)).toEqual(['s3']);
  });
  it('reporte nuevo: todo Mantención + responsables, sin el que reporta', () => {
    expect(noticeFailureCreated(f(), ctx('s1')).recipients.sort()).toEqual(['m1', 'm2', 's2']);
    expect(noticeFailureCreated(f(), ctx('m1')).recipients.sort()).toEqual(['m2', 's1', 's2']);
  });
  it('hallazgo y urgencia cambian el título', () => {
    expect(noticeFailureCreated(f({ tipo: 'hallazgo' }), ctx('x')).title).toBe('Nuevo hallazgo #7');
    const u = noticeFailureCreated(f({ severidad: 'urgente' }), ctx('x'));
    expect(u.title).toBe('Falla URGENTE #7'); expect(u.urgent).toBe(true);
  });
  it('cambio de estado: solo responsables del área, sin quien lo cambió', () => {
    const n = noticeStatusChanged(f(), 'resuelto', 'Cambié el palpador', ctx('m1'));
    expect(n.recipients.sort()).toEqual(['s1', 's2']); expect(n.title).toBe('Falla #7: Resuelto'); expect(n.body).toContain('Cambié el palpador');
    expect(noticeStatusChanged(f(), 'cerrado', '', ctx('s1')).recipients).toEqual(['s2']);
  });
  it('caso asignado: solo el encargado (y nadie si se lo asigna a sí mismo)', () => {
    expect(noticeCaseAssigned(f({ encargado_id: 'm2' }), ctx('adm')).recipients).toEqual(['m2']);
    expect(noticeCaseAssigned(f({ encargado_id: 'm2' }), ctx('m2')).recipients).toEqual([]);
    expect(noticeCaseAssigned(f(), ctx('adm')).recipients).toEqual([]);
  });
  it('área o equipo asignado: solo la persona a cargo', () => {
    expect(noticeAreaAssigned({ id: 'a1', profile_id: 's1', asset_id: null, area_id: 'ar1' }, 'Aluminio', ctx('adm'))).toMatchObject({ recipients: ['s1'], title: 'Se te asignó un área', body: 'Área Aluminio' });
    expect(noticeAreaAssigned({ id: 'a2', profile_id: 's2', asset_id: 'maq', area_id: null }, undefined, ctx('adm'))).toMatchObject({ recipients: ['s2'], title: 'Se te asignó un equipo', url: '/activos/maq' });
  });
});
