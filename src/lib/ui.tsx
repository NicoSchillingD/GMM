import type { Asset, FailureStatus, AssetStatus } from './types';

export const ASSET_STATUS: Record<AssetStatus, [string, string]> = {
  operativo: ['Operativo', 'ok'], fuera_servicio: ['Fuera de servicio', 'bad'],
  en_mantencion: ['En mantención', 'warn'], standby: ['Standby', 'info'], desincorporado: ['Desincorporado', ''],
};
export const FAIL_STATUS: Record<FailureStatus, [string, string]> = {
  abierto: ['Abierto', 'bad'], en_revision: ['En revisión', 'warn'], en_curso: ['En curso', 'info'],
  resuelto: ['Resuelto', 'ok'], cerrado: ['Cerrado', ''],
};
export const Badge = ({ t, c = '' }: { t: string; c?: string }) => <span className={`badge ${c}`}>{t}</span>;
export const AssetBadge = ({ s }: { s: AssetStatus }) => <Badge t={ASSET_STATUS[s][0]} c={ASSET_STATUS[s][1]} />;
export const FailBadge = ({ s }: { s: FailureStatus }) => <Badge t={FAIL_STATUS[s][0]} c={FAIL_STATUS[s][1]} />;
export const SevBadge = ({ s }: { s: 'urgente' | 'informativo' }) => <Badge t={s === 'urgente' ? 'Urgente' : 'Informativo'} c={s === 'urgente' ? 'bad' : 'info'} />;
export const assetLabel = (a?: Asset) => (a ? `${a.tag || 'S/TAG'} · ${a.tipo} ${a.marca}`.trim() : '—');
export const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '—');
export const hrs = (h: number | null) => (h == null ? '—' : `${h.toFixed(1)} h`);

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
