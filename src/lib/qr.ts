import type { Asset } from './types';

/** Contenido del QR de un activo: abre el reporte con el equipo ya elegido (sirve también con la cámara del teléfono). */
export const assetQrUrl = (assetId: string, origin = window.location.origin) => `${origin}/fallas/nueva?activo=${encodeURIComponent(assetId)}`;

export interface ScanMatch { asset?: Asset; candidates: Asset[] }

/** Interpreta lo leído en un QR: URL con `?activo=<id>`, o el TAG impreso. Si el TAG está repetido, devuelve todos los candidatos. */
export function resolveScan(text: string, assets: Asset[]): ScanMatch {
  const raw = text.trim();
  let id: string | null = null;
  try { id = new URL(raw).searchParams.get('activo'); } catch { /* no es URL */ }
  if (id) { const a = assets.find((x) => x.id === id); return { asset: a, candidates: a ? [a] : [] }; }
  const byId = assets.find((x) => x.id === raw);
  if (byId) return { asset: byId, candidates: [byId] };
  const tag = raw.toLowerCase();
  const c = tag ? assets.filter((x) => x.tag.trim().toLowerCase() === tag) : [];
  return { asset: c.length === 1 ? c[0] : undefined, candidates: c };
}
