import csv from '../../data/inventory.csv?raw';
import type { Area, Asset, Profile, Assignment } from './types';

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');

/** Parser CSV simple (sin comillas, el inventario no las usa). */
export function parseInventory(text: string) {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const cols = head.split(',');
  return lines.map((l) => {
    const v = l.split(',');
    return Object.fromEntries(cols.map((c, i) => [c, (v[i] ?? '').trim()])) as Record<string, string>;
  });
}

export function mapStatus(estado: string, diagnostico: string): Asset['estado'] {
  const e = estado.trim().toUpperCase();
  if (e === 'OP') return 'operativo';
  if (e === 'EN MANT.') return 'en_mantencion';
  if (e === 'STANDBY') return 'standby';
  return diagnostico.toLowerCase().includes('desincorporado') ? 'desincorporado' : 'fuera_servicio';
}

export function buildSeed() {
  const rows = parseInventory(csv);
  const areas: Area[] = [...new Set(rows.map((r) => r.area))].map((nombre) => ({ id: `area-${slug(nombre)}`, nombre }));
  const people = [...new Set(rows.map((r) => r.responsable).filter(Boolean))];
  const profiles: Profile[] = [
    { id: 'u-admin', nombre: 'Administrador GMM', email: 'admin@glasstech.cl', rol: 'admin' },
    { id: 'u-mant', nombre: 'Equipo Mantenimiento', email: 'mantenimiento@glasstech.cl', rol: 'mantenimiento' },
    ...people.map((nombre) => ({ id: `u-${slug(nombre)}`, nombre, email: `${slug(nombre)}@glasstech.cl`, rol: 'supervisor' as const })),
  ];
  const assets: Asset[] = rows.map((r) => ({
    id: `a-${r.n}`, parent_id: null, area_id: `area-${slug(r.area)}`, tag: r.tag, tipo: r.tipo, marca: r.marca,
    modelo: r.modelo, serie: r.serie, anio_fab: r.fabricacion ? Number(r.fabricacion) : null,
    estado: mapStatus(r.estado, r.diagnostico),
    criticidad: r.prioridad, diagnostico: r.diagnostico, es_componente: false,
  }));
  const assignments: Assignment[] = rows.filter((r) => r.responsable).map((r) => ({ id: `as-${r.n}`, profile_id: `u-${slug(r.responsable)}`, asset_id: `a-${r.n}`, area_id: null }));
  return { areas, profiles, assets, assignments };
}
