// Edita o elimina un perfil (y su usuario de acceso). Solo puede invocarlo un admin de GMM.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const ROLES = ['admin', 'mantenimiento', 'supervisor', 'consulta'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /i, '');
  const { data: caller } = await admin.auth.getUser(token);
  if (!caller?.user) return json({ error: 'No autenticado' }, 401);
  const { data: me } = await admin.from('profiles').select('rol').eq('id', caller.user.id).maybeSingle();
  if (me?.rol !== 'admin') return json({ error: 'Solo administradores' }, 403);

  const { action, id, nombre, email, rol } = await req.json().catch(() => ({}));
  if (!['update', 'delete'].includes(action) || typeof id !== 'string') return json({ error: 'Solicitud inválida' }, 400);
  const { data: target } = await admin.from('profiles').select('id, nombre, email, rol').eq('id', id).maybeSingle();
  if (!target) return json({ error: 'Perfil no encontrado' }, 404);

  const otherAdmins = async () =>
    (await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('rol', 'admin').neq('id', id)).count ?? 0;
  const noAuthUser = (e: { status?: number; code?: string } | null) => !!e && (e.status === 404 || e.code === 'user_not_found');

  if (action === 'delete') {
    if (id === caller.user.id) return json({ error: 'No puedes eliminar tu propio perfil.' }, 400);
    if (target.rol === 'admin' && (await otherAdmins()) === 0) return json({ error: 'Debe quedar al menos un administrador.' }, 400);
    const reports = (await admin.from('failures').select('id', { count: 'exact', head: true }).eq('reportado_por', id)).count ?? 0;
    const comments = (await admin.from('feedback').select('id', { count: 'exact', head: true }).eq('autor', id)).count ?? 0;
    if (reports + comments > 0)
      return json({ error: `Tiene ${reports} reporte(s) y ${comments} comentario(s) de falla; eliminarlo borraría ese historial. Cámbiale el rol a "Consulta" en su lugar.` }, 409);
    const { error: de } = await admin.auth.admin.deleteUser(id);
    if (de && !noAuthUser(de)) return json({ error: de.message }, 400);
    const { error } = await admin.from('profiles').delete().eq('id', id); // sus asignaciones se eliminan en cascada
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  // update
  const nuevoNombre = String(nombre ?? '').trim();
  const nuevoEmail = String(email ?? '').trim();
  if (!nuevoNombre || !EMAIL.test(nuevoEmail) || !ROLES.includes(rol)) return json({ error: 'Datos inválidos (nombre, correo y rol).' }, 400);
  if (target.rol === 'admin' && rol !== 'admin' && (await otherAdmins()) === 0) return json({ error: 'Debe quedar al menos un administrador.' }, 400);

  if (nuevoEmail.toLowerCase() !== target.email.toLowerCase()) {
    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).ilike('email', nuevoEmail).neq('id', id);
    if (count) return json({ error: 'Ese correo ya pertenece a otro perfil.' }, 409);
    const { error: ue } = await admin.auth.admin.updateUserById(id, { email: nuevoEmail, email_confirm: true });
    if (ue && !noAuthUser(ue)) return json({ error: ue.message }, 400);
  }
  const { error } = await admin.from('profiles').update({ nombre: nuevoNombre, email: nuevoEmail, rol }).eq('id', id);
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
});
