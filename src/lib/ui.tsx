import type { Asset, FailureKind, FailureStatus, AssetStatus } from './types';

export const ASSET_STATUS: Record<AssetStatus, [string, string]> = {
  operativo: ['Operativo', 'ok'], fuera_servicio: ['Fuera de servicio', 'bad'],
  en_mantencion: ['En mantención', 'warn'], standby: ['Standby', 'info'], desincorporado: ['Desincorporado', ''],
};
export const FAIL_STATUS: Record<FailureStatus, [string, string]> = {
  abierto: ['Abierto', 'bad'], en_revision: ['En revisión', 'warn'], gestion_compra: ['Gestión de compra', 'info'],
  resuelto: ['Resuelto', 'ok'], cerrado: ['Cerrado', ''],
};
export const Badge = ({ t, c = '' }: { t: string; c?: string }) => <span className={`badge ${c}`}>{t}</span>;
export const AssetBadge = ({ s }: { s: AssetStatus }) => <Badge t={ASSET_STATUS[s][0]} c={ASSET_STATUS[s][1]} />;
export const FailBadge = ({ s }: { s: FailureStatus }) => <Badge t={FAIL_STATUS[s][0]} c={FAIL_STATUS[s][1]} />;
export const KIND: Record<FailureKind, string> = { falla: 'Falla', hallazgo: 'Hallazgo' };
export const KindBadge = ({ k }: { k?: FailureKind }) => <Badge t={KIND[k ?? 'falla']} c={k === 'hallazgo' ? 'warn' : ''} />;
export const SevBadge = ({ s }: { s: 'urgente' | 'informativo' }) => <Badge t={s === 'urgente' ? 'Urgente' : 'Informativo'} c={s === 'urgente' ? 'bad' : 'info'} />;
export const assetLabel = (a?: Asset) => (a ? `${a.tag || 'S/TAG'} · ${a.tipo} ${a.marca}`.trim() : '—');
export const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '—');
/** Fecha sin hora (AAAA-MM-DD) en formato local, sin desfase por zona horaria. */
export const fmtDate = (d?: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('es-CL') : '—');
export const hrs = (h: number | null) => (h == null ? '—' : `${h.toFixed(1)} h`);

export const MAX_PHOTOS = 3;
export const MAX_VIDEOS = 2;
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

/** Duración (s) de un archivo de video, o null si el navegador no puede leerla. */
export function videoDuration(blob: Blob): Promise<number | null> {
  return new Promise((res) => {
    const v = document.createElement('video'); const url = URL.createObjectURL(blob);
    const done = (d: number | null) => { URL.revokeObjectURL(url); res(d); };
    v.preload = 'metadata'; v.onloadedmetadata = () => done(Number.isFinite(v.duration) ? v.duration : null); v.onerror = () => done(null); v.src = url;
  });
}
export const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
export const videoExt = (type: string) => (type.includes('mp4') ? 'mp4' : type.includes('quicktime') ? 'mov' : 'webm');

/** Reduce la foto en el cliente (máx. 1280px, JPEG) para subirla/guardarla liviana. */
export function compressImage(file: File, max = 1280): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}
