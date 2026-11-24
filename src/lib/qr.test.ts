import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { assetQrUrl, resolveScan } from './qr';
import type { Asset } from './types';

const a = (id: string, tag: string): Asset => ({ id, tag, parent_id: null, area_id: null, tipo: '', marca: '', modelo: '', serie: '', anio_fab: null, estado: 'operativo', criticidad: '', diagnostico: '', es_componente: false });
const assets = [a('a-1', 'PU-PL1-FO3078'), a('a-2', 'DUP-1'), a('a-3', 'dup-1'), a('a-4', '')];

describe('QR de activos', () => {
  it('la URL del QR se decodifica de vuelta (generar con qrcode, leer con jsQR)', () => {
    const text = assetQrUrl('a-1', 'https://gmm.example.com');
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size, scale = 6, quiet = 4, size = (n + quiet * 2) * scale;
    const px = new Uint8ClampedArray(size * size * 4).fill(255);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.modules.get(x, y))
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) { const i = (((y + quiet) * scale + dy) * size + (x + quiet) * scale + dx) * 4; px[i] = px[i + 1] = px[i + 2] = 0; }
    expect(jsQR(px, size, size)?.data).toBe(text);
  });
  it('resuelve por URL, por id y por TAG', () => {
    expect(resolveScan('https://gmm.example.com/fallas/nueva?activo=a-1', assets).asset?.id).toBe('a-1');
    expect(resolveScan('a-1', assets).asset?.id).toBe('a-1');
    expect(resolveScan(' pu-pl1-fo3078 ', assets).asset?.id).toBe('a-1');
  });
  it('un TAG repetido devuelve candidatos sin elegir uno; lo desconocido no resuelve', () => {
    const r = resolveScan('DUP-1', assets);
    expect(r.asset).toBeUndefined(); expect(r.candidates.map((x) => x.id)).toEqual(['a-2', 'a-3']);
    expect(resolveScan('nada', assets).candidates).toEqual([]);
    expect(resolveScan('', assets).candidates).toEqual([]);
  });
});
