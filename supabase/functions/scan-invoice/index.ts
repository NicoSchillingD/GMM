// Lee una factura o boleta (foto o PDF) con Claude y devuelve los campos del costo. Solo admin o mantenimiento.
// Requiere el secreto ANTHROPIC_API_KEY en la función.
import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@1.11.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_B64 = 7_000_000; // ~5 MB de archivo

const SCHEMA = {
  type: 'object',
  properties: {
    legible: { type: 'boolean', description: 'false si la imagen no es una factura, boleta u orden de compra legible' },
    tipo: { type: 'string', enum: ['factura', 'gasto', 'compra'] },
    numero: { type: 'string', description: 'Folio o número del documento, solo el número' },
    proveedor: { type: 'string', description: 'Razón social o nombre del emisor/proveedor' },
    rut: { type: 'string', description: 'RUT del emisor con formato 12.345.678-9, o vacío' },
    monto: { type: 'integer', description: 'Monto TOTAL a pagar en pesos chilenos (IVA incluido), sin puntos ni símbolos; 0 si no se lee' },
    fecha: { type: 'string', description: 'Fecha de emisión en formato AAAA-MM-DD, o vacío si no se lee' },
  },
  required: ['legible', 'tipo', 'numero', 'proveedor', 'rut', 'monto', 'fecha'],
  additionalProperties: false,
} as const;

const PROMPT = `Extrae los datos de este documento de compra chileno para registrar un costo de mantenimiento.
- tipo: "factura" si es una factura (afecta o exenta, electrónica o no); "gasto" si es una boleta o comprobante de gasto menor; "compra" si es una orden de compra o cotización.
- numero: el folio ("N° 12345"), sin texto adicional.
- proveedor: razón social de quien emite el documento (no del comprador).
- monto: el TOTAL final a pagar, IVA incluido, como entero en CLP. En Chile el punto separa los miles (1.234.567 = 1234567) y la coma los decimales.
- fecha: fecha de emisión como AAAA-MM-DD.
No inventes datos: si algo no se lee con seguridad, déjalo vacío (o 0 en el monto). Si el archivo no es un documento de compra legible, devuelve legible=false.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /i, '');
  const { data: caller } = await admin.auth.getUser(token);
  if (!caller?.user) return json({ error: 'No autenticado' }, 401);
  const { data: me } = await admin.from('profiles').select('rol').eq('id', caller.user.id).maybeSingle();
  if (!me || !['admin', 'mantenimiento'].includes(me.rol)) return json({ error: 'Solo Mantenimiento o administradores' }, 403);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'El escaneo no está configurado: falta el secreto ANTHROPIC_API_KEY en Supabase.' }, 503);

  const { data: b64, media_type: mt } = await req.json().catch(() => ({}));
  if (typeof b64 !== 'string' || typeof mt !== 'string') return json({ error: 'Archivo inválido' }, 400);
  if (b64.length > MAX_B64) return json({ error: 'El archivo es demasiado grande (máx. 5 MB).' }, 413);
  const isPdf = mt === 'application/pdf';
  if (!isPdf && !IMAGES.includes(mt)) return json({ error: 'Formato no soportado: usa foto (JPG/PNG) o PDF.' }, 400);

  const file = isPdf
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: b64 } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: mt as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: b64 } };

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA as unknown as Record<string, unknown> } },
      messages: [{ role: 'user', content: [file, { type: 'text', text: PROMPT }] }],
    });
    if (res.stop_reason === 'refusal') return json({ error: 'No se pudo leer el documento. Ingresa los datos manualmente.' }, 422);
    const text = res.content.find((b) => b.type === 'text');
    const out = text && text.type === 'text' ? JSON.parse(text.text) : null;
    if (!out) return json({ error: 'No se obtuvo respuesta del lector. Intenta de nuevo.' }, 502);
    if (!out.legible) return json({ error: 'No parece una factura o boleta legible. Intenta con otra foto más nítida.' }, 422);
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(out.fecha) ? out.fecha : '';
    return json({ ok: true, tipo: out.tipo, numero: String(out.numero ?? '').trim(), proveedor: String(out.proveedor ?? '').trim(), rut: String(out.rut ?? '').trim(), monto: Math.max(0, Math.round(Number(out.monto) || 0)), fecha });
  } catch (e) {
    const status = e instanceof Anthropic.APIError ? e.status : undefined;
    console.error('scan-invoice', status, e instanceof Error ? e.message : e);
    if (status === 401) return json({ error: 'La clave de Anthropic configurada no es válida.' }, 502);
    if (status === 429) return json({ error: 'Servicio de lectura saturado. Intenta en un minuto.' }, 429);
    return json({ error: 'No se pudo leer el documento. Ingresa los datos manualmente.' }, 502);
  }
});
