// Crea un usuario (correo + contraseña) y su perfil. Solo puede invocarlo un admin de GMM.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const ROLES = ['admin', 'mantenimiento', 'supervisor', 'consulta'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /i, '');
  const { data: caller } = await admin.auth.getUser(token);
  if (!caller?.user) return json({ error: 'No autenticado' }, 401);
  const { data: me } = await admin.from('profiles').select('rol').eq('id', caller.user.id).maybeSingle();
  if (me?.rol !== 'admin') return json({ error: 'Solo administradores' }, 403);

  const { nombre, email, rol, password } = await req.json().catch(() => ({}));
  if (!nombre || !email || !ROLES.includes(rol) || typeof password !== 'string' || password.length < 8)
    return json({ error: 'Datos inválidos (nombre, correo, rol y contraseña de 8+ caracteres)' }, 400);

  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !created.user) return json({ error: error?.message ?? 'No se pudo crear el usuario' }, 400);

  // Si el correo ya tenía perfil precargado se enlaza (el id cambia en cascada); si no, se crea.
  const { error: pe } = await admin.from('profiles').upsert({ id: created.user.id, nombre, email, rol }, { onConflict: 'email' });
  if (pe) return json({ error: pe.message }, 400);
  return json({ ok: true, id: created.user.id });
});
