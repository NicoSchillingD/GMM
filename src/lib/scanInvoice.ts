import { isDemo, supabase } from './db';
import { compressImage } from './ui';

export interface InvoiceScan { tipo: 'compra' | 'gasto' | 'factura'; numero: string; proveedor: string; rut: string; monto: number; fecha: string }

const MAX_PDF = 4 * 1024 * 1024;

const readB64 = (f: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1] ?? '');
  r.onerror = () => rej(r.error);
  r.readAsDataURL(f);
});

/** Envía la foto (o PDF) de una factura/boleta a la función `scan-invoice` y devuelve los campos leídos. */
export async function scanInvoice(file: File): Promise<InvoiceScan> {
  if (isDemo || !supabase) throw new Error('El escaneo solo está disponible con Supabase conectado.');
  let data: string; let media_type: string;
  if (file.type === 'application/pdf') {
    if (file.size > MAX_PDF) throw new Error('El PDF pesa más de 4 MB. Usa una foto o un PDF más liviano.');
    data = await readB64(file); media_type = 'application/pdf';
  } else if (file.type.startsWith('image/')) {
    const url = await compressImage(file, 1800); // más resolución que las fotos de fallas: hay que leer texto pequeño
    data = url.split(',')[1] ?? ''; media_type = 'image/jpeg';
  } else throw new Error('Formato no soportado: usa una foto o un PDF.');

  const { data: r, error } = await supabase.functions.invoke('scan-invoice', { body: { data, media_type } });
  let reason: string | undefined = r?.error;
  if (!reason && error && 'context' in error) reason = (await (error as { context: Response }).context.json().catch(() => null))?.error;
  if (error || r?.error) throw new Error(reason ?? 'No se pudo leer el documento.');
  return r as InvoiceScan;
}
