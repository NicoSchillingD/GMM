// Notificaciones push: registra los dispositivos y avisa según los eventos de la App. Solo usuarios con sesión.
// Las claves VAPID se generan la primera vez y se guardan en push_config (solo la service role las lee).
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { noticeAreaAssigned, noticeCaseAssigned, noticeFailureCreated, noticeStatusChanged, type Notice } from './recipients.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const SUBJECT = 'https://gmm-glasstech-operaciones.vercel.app';
const RECENT_MS = 10 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /i, '');
  const { data: caller } = await db.auth.getUser(token);
  if (!caller?.user) return json({ error: 'No autenticado' }, 401);
  const { data: me } = await db.from('profiles').select('id, rol').eq('id', caller.user.id).maybeSingle();
  if (!me) return json({ error: 'Sin perfil' }, 403);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? '');

  // Claves VAPID: se crean una vez.
  const keys = async () => {
    let { data } = await db.from('push_config').select('public_key, private_key').eq('id', 1).maybeSingle();
    if (!data) {
      const k = webpush.generateVAPIDKeys();
      await db.from('push_config').upsert({ id: 1, public_key: k.publicKey, private_key: k.privateKey }, { onConflict: 'id', ignoreDuplicates: true });
      ({ data } = await db.from('push_config').select('public_key, private_key').eq('id', 1).maybeSingle());
    }
    return data!;
  };

  if (action === 'public-key') return json({ ok: true, key: (await keys()).public_key });

  if (action === 'subscribe') {
    const s = body.subscription;
    if (!s?.endpoint || !s?.keys?.p256dh || !s?.keys?.auth) return json({ error: 'Suscripción inválida' }, 400);
    const { error } = await db.from('push_subscriptions').upsert({ endpoint: s.endpoint, profile_id: me.id, p256dh: s.keys.p256dh, auth: s.keys.auth, user_agent: String(body.user_agent ?? '').slice(0, 200) }, { onConflict: 'endpoint' });
    return error ? json({ error: error.message }, 400) : json({ ok: true });
  }
  if (action === 'unsubscribe') {
    if (typeof body.endpoint === 'string') await db.from('push_subscriptions').delete().eq('endpoint', body.endpoint).eq('profile_id', me.id);
    return json({ ok: true });
  }
  if (action !== 'notify') return json({ error: 'Acción inválida' }, 400);

  // ── Avisos: los destinatarios y el texto salen de la base de datos, nunca del cliente ──
  const [{ data: profiles }, { data: assets }, { data: assignments }] = await Promise.all([
    db.from('profiles').select('id, nombre, rol'), db.from('assets').select('id, parent_id, area_id, tag, tipo, marca'), db.from('assignments').select('id, profile_id, asset_id, area_id'),
  ]);
  const c = { profiles: profiles ?? [], assets: assets ?? [], assignments: assignments ?? [], actor: me.id };
  const mant = me.rol === 'admin' || me.rol === 'mantenimiento';
  const recent = (iso: string) => Date.now() - new Date(iso).getTime() < RECENT_MS;
  const loadFailure = async (id: unknown) => (typeof id === 'string' ? (await db.from('failures').select('id, numero, tipo, asset_id, severidad, detiene_produccion, descripcion, encargado_id, reportado_por, creado').eq('id', id).maybeSingle()).data : null);

  let notice: Notice | null = null; let key = '';
  switch (body.event) {
    case 'failure_created': {
      const f = await loadFailure(body.failure_id);
      if (!f || f.reportado_por !== me.id || !recent(f.creado)) return json({ error: 'Evento no válido' }, 403);
      notice = noticeFailureCreated(f, c); key = `created:${f.id}`; break;
    }
    case 'status_changed': {
      const { data: fb } = typeof body.feedback_id === 'string' ? await db.from('feedback').select('id, failure_id, autor, estado, comentario, creado').eq('id', body.feedback_id).maybeSingle() : { data: null };
      if (!fb || fb.autor !== me.id || !fb.estado || !recent(fb.creado)) return json({ error: 'Evento no válido' }, 403);
      const f = await loadFailure(fb.failure_id); if (!f) return json({ error: 'Falla no encontrada' }, 404);
      notice = noticeStatusChanged(f, fb.estado, fb.comentario ?? '', c); key = `status:${fb.id}`; break;
    }
    case 'case_assigned': {
      const f = await loadFailure(body.failure_id);
      if (!mant || !f || !f.encargado_id) return json({ error: 'Evento no válido' }, 403);
      notice = noticeCaseAssigned(f, c); key = `assigned:${f.id}:${f.encargado_id}:${Math.floor(Date.now() / RECENT_MS)}`; break;
    }
    case 'area_assigned': {
      const { data: s } = typeof body.assignment_id === 'string' ? await db.from('assignments').select('id, profile_id, asset_id, area_id').eq('id', body.assignment_id).maybeSingle() : { data: null };
      if (me.rol !== 'admin' || !s) return json({ error: 'Evento no válido' }, 403);
      const area = s.area_id ? (await db.from('areas').select('nombre').eq('id', s.area_id).maybeSingle()).data?.nombre : undefined;
      notice = noticeAreaAssigned(s, area, c); key = `asg:${s.id}`; break;
    }
    default: return json({ error: 'Evento desconocido' }, 400);
  }
  if (!notice.recipients.length) return json({ ok: true, sent: 0, reason: 'sin destinatarios' });

  // Un evento se envía una sola vez.
  const { error: dup } = await db.from('push_log').insert({ key });
  if (dup) return json({ ok: true, sent: 0, reason: 'ya enviado' });

  const { data: subs } = await db.from('push_subscriptions').select('endpoint, p256dh, auth').in('profile_id', notice.recipients);
  if (!subs?.length) return json({ ok: true, sent: 0, reason: 'sin dispositivos' });
  const k = await keys();
  webpush.setVapidDetails(SUBJECT, k.public_key, k.private_key);
  const payload = JSON.stringify({ title: notice.title, body: notice.body, url: notice.url, tag: notice.tag });
  let sent = 0; const dead: string[] = [];
  await Promise.all(subs.map(async (s) => {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600, urgency: notice!.urgent ? 'high' : 'normal' }); sent++; }
    catch (e) { const code = (e as { statusCode?: number }).statusCode; if (code === 404 || code === 410) dead.push(s.endpoint); else console.error('push', code, (e as Error).message); }
  }));
  if (dead.length) await db.from('push_subscriptions').delete().in('endpoint', dead);
  return json({ ok: true, sent, recipients: notice.recipients.length, devices: subs.length });
});
