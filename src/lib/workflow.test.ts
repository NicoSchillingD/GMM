import { describe, expect, it } from 'vitest';
import { allowedTransitions, isAreaOwner } from './workflow';
import type { Asset, Assignment } from './types';

const asset = (id: string, area_id: string | null, parent_id: string | null = null): Asset => ({
  id, parent_id, area_id, tag: id, tipo: '', marca: '', modelo: '', serie: '', anio_fab: null,
  estado: 'operativo', criticidad: '', diagnostico: '', es_componente: !!parent_id,
});
const assets = [asset('m1', 'a1'), asset('c1', null, 'm1'), asset('m2', 'a2')];
const asg = (profile_id: string, o: Partial<Assignment>): Assignment => ({ id: Math.random() + '', profile_id, asset_id: null, area_id: null, ...o });
const assignments = [asg('sup1', { area_id: 'a1' }), asg('sup2', { asset_id: 'm2' })];
const U = (id: string, rol: 'admin' | 'mantenimiento' | 'supervisor' | 'consulta') => ({ id, rol });
const t = (estado: 'abierto' | 'en_revision' | 'gestion_compra' | 'resuelto' | 'cerrado', asset_id = 'm1', u = U('mant', 'mantenimiento')) =>
  allowedTransitions({ estado, asset_id }, u, assets, assignments);

describe('flujo de fallas', () => {
  it('Mantención avanza Abierto → En revisión → (Gestión de compra) → Resuelto', () => {
    expect(t('abierto')).toEqual(['en_revision']);
    expect(t('en_revision')).toEqual(['gestion_compra', 'resuelto']);
    expect(t('gestion_compra')).toEqual(['en_revision', 'resuelto']);
  });
  it('Mantención no puede cerrar; solo el responsable del área', () => {
    expect(t('resuelto')).toEqual(['en_revision']);
    expect(t('resuelto', 'm1', U('sup1', 'supervisor'))).toEqual(['cerrado', 'en_revision']);
    expect(t('resuelto', 'm1', U('adm', 'admin'))).toEqual(['cerrado', 'en_revision']);
  });
  it('el supervisor no mueve estados intermedios ni cierra fuera de su área', () => {
    expect(t('abierto', 'm1', U('sup1', 'supervisor'))).toEqual([]);
    expect(t('resuelto', 'm2', U('sup1', 'supervisor'))).toEqual([]);
    expect(t('resuelto', 'm2', U('sup2', 'supervisor'))).toEqual(['cerrado', 'en_revision']);
  });
  it('consulta no mueve nada y cerrado es final', () => {
    expect(t('resuelto', 'm1', U('c', 'consulta'))).toEqual([]);
    expect(t('cerrado', 'm1', U('adm', 'admin'))).toEqual([]);
  });
  it('el responsable del área cubre los componentes de sus activos', () => {
    expect(isAreaOwner(U('sup1', 'supervisor'), 'c1', assets, assignments)).toBe(true);
    expect(isAreaOwner(U('sup2', 'supervisor'), 'c1', assets, assignments)).toBe(false);
  });
});
