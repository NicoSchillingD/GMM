import { insert, remove, supabase, uid, update } from './db';
import type { Failure, Tables } from './types';

type Data = { [K in keyof Tables]: Tables[K][] };

/** Registra en el historial quién editó la falla y qué campos cambió. */
export async function logEdit(f: Failure, adminId: string, changed: string[]) {
  if (!changed.length) return;
  await insert('feedback', { id: uid(), failure_id: f.id, autor: adminId, comentario: `Datos editados por un administrador: ${changed.join(', ')}.`, estado: null, creado: new Date().toISOString() });
}

/** Qué se verá afectado al eliminar la falla (para avisar antes de confirmar). */
export const deletionImpact = (f: Failure, d: Data) => ({
  comentarios: d.feedback.filter((x) => x.failure_id === f.id).length,
  costos: d.cost_docs.filter((x) => x.failure_id === f.id).length,
  ordenes: d.work_orders.filter((x) => x.failure_id === f.id).length,
  archivos: f.fotos.length + (f.videos?.length ?? 0),
});

/** Elimina la falla. Costos y órdenes de trabajo se conservan sin vínculo; comentarios y archivos se borran. */
export async function deleteFailure(f: Failure, d: Data) {
  if (supabase) {
    const bucket = supabase.storage.from('failure-photos');
    const { data: files } = await bucket.list(f.id);
    if (files?.length) await bucket.remove(files.map((x) => `${f.id}/${x.name}`));
    await remove('failures', f.id); // comentarios en cascada; costos y órdenes quedan sin falla (migración 0008)
    return;
  }
  d.feedback.filter((x) => x.failure_id === f.id).forEach((x) => void remove('feedback', x.id));
  for (const c of d.cost_docs.filter((x) => x.failure_id === f.id)) await update('cost_docs', c.id, { failure_id: null });
  for (const w of d.work_orders.filter((x) => x.failure_id === f.id)) await update('work_orders', w.id, { failure_id: null });
  await remove('failures', f.id);
}
