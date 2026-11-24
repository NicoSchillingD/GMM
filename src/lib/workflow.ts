import type { Asset, Assignment, Failure, FailureStatus, Profile } from './types';
import { insert, uid, update } from './db';

/** Columnas del flujo, en orden. */
export const STATUS_FLOW: FailureStatus[] = ['abierto', 'en_revision', 'gestion_compra', 'resuelto', 'cerrado'];

/** Quién puede hacer cada paso del flujo:
 *  Abierto → En revisión (Mantención, con encargado asignado) → Gestión de compra (manual, si hay compra) →
 *  Resuelto (Mantención) → Cerrado (responsable del área: valida la reparación). */
const NEXT: Record<FailureStatus, { to: FailureStatus; by: 'mant' | 'owner' | 'both' }[]> = {
  abierto: [{ to: 'en_revision', by: 'mant' }],
  en_revision: [{ to: 'gestion_compra', by: 'mant' }, { to: 'resuelto', by: 'mant' }],
  gestion_compra: [{ to: 'en_revision', by: 'mant' }, { to: 'resuelto', by: 'mant' }],
  resuelto: [{ to: 'cerrado', by: 'owner' }, { to: 'en_revision', by: 'both' }], // reabrir si la validación falla
  cerrado: [],
};

export const isMantenimiento = (u: Pick<Profile, 'rol'> | null) => !!u && (u.rol === 'admin' || u.rol === 'mantenimiento');

/** Responsable del área: administrador, o supervisor con asignación sobre el activo, un activo padre o su área. */
export function isAreaOwner(u: Pick<Profile, 'id' | 'rol'> | null, assetId: string, assets: Asset[], assignments: Assignment[]): boolean {
  if (!u) return false;
  if (u.rol === 'admin') return true;
  if (u.rol !== 'supervisor') return false;
  const mine = assignments.filter((a) => a.profile_id === u.id);
  const byId = new Map(assets.map((a) => [a.id, a]));
  const asset = byId.get(assetId);
  if (!asset) return false;
  const areaIds = new Set(mine.flatMap((a) => (a.area_id ? [a.area_id] : [])));
  const assetIds = new Set(mine.flatMap((a) => (a.asset_id ? [a.asset_id] : [])));
  for (let cur: Asset | undefined = asset, hops = 0; cur && hops < 20; cur = cur.parent_id ? byId.get(cur.parent_id) : undefined, hops++) {
    if (assetIds.has(cur.id) || (cur.area_id && areaIds.has(cur.area_id))) return true;
  }
  return false;
}

/** Estados a los que el usuario puede mover la falla desde su estado actual. */
export function allowedTransitions(f: Pick<Failure, 'estado' | 'asset_id'>, u: Pick<Profile, 'id' | 'rol'> | null, assets: Asset[], assignments: Assignment[]): FailureStatus[] {
  const mant = isMantenimiento(u);
  const owner = isAreaOwner(u, f.asset_id, assets, assignments);
  return NEXT[f.estado].filter((n) => (n.by === 'mant' ? mant : n.by === 'owner' ? owner : mant || owner)).map((n) => n.to);
}

/** Cambia el estado: guarda el comentario (opcional) en el historial y aplica los efectos del paso. */
export async function changeStatus(f: Failure, to: FailureStatus, authorId: string, comment: string, encargadoId?: string | null): Promise<void> {
  const now = new Date().toISOString();
  const patch: Partial<Failure> = { estado: to };
  if (to === 'en_revision') {
    const enc = encargadoId ?? f.encargado_id;
    if (!enc) throw new Error('Asigna un encargado antes de pasar a "En revisión".');
    patch.encargado_id = enc;
    if (!f.fecha_inicio_solucion) patch.fecha_inicio_solucion = now;
  }
  if (to === 'resuelto' && f.detiene_produccion && !f.liberacion) patch.liberacion = now;
  await insert('feedback', { id: uid(), failure_id: f.id, autor: authorId, comentario: comment.trim(), estado: to, creado: now });
  await update('failures', f.id, patch);
  if (to === 'resuelto' && (f.tipo ?? 'falla') === 'falla') await update('assets', f.asset_id, { estado: 'operativo' });
}
