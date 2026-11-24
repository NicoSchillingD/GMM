import { useState } from 'react';
import { useApp } from '../lib/app';
import { insert, isDemo, remove, supabase, uid, update } from '../lib/db';
import type { Profile, Role } from '../lib/types';

export default function UsersPage() {
  const { data, me, reload, can } = useApp();
  const [sel, setSel] = useState<string | null>(null);
  const [asg, setAsg] = useState({ kind: 'area', target: '' });
  const [nu, setNu] = useState({ nombre: '', email: '', rol: 'supervisor' as Role, password: '' });
  const [msg, setMsg] = useState('');
  const [ed, setEd] = useState<{ nombre: string; email: string; rol: Role } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState('');
  const pick = (p: Profile) => { setSel(p.id); setPw(''); setAsgMsg(''); if (window.matchMedia('(max-width: 820px)').matches) window.scrollTo({ top: 0 }); setEd({ nombre: p.nombre, email: p.email, rol: p.rol }); setMsg(''); };
  const admins = data.profiles.filter((p) => p.rol === 'admin');

  /** Edita o elimina un perfil. En Supabase pasa por la función de servidor (que también cambia/elimina el acceso). */
  const manage = async (action: 'update' | 'delete', p: Profile, v?: { nombre: string; email: string; rol: Role }): Promise<boolean> => {
    setBusy(true); setMsg('');
    try {
      if (isDemo) {
        const lastAdmin = p.rol === 'admin' && admins.length === 1;
        if (action === 'delete') {
          if (p.id === me!.id) return fail('No puedes eliminar tu propio perfil.');
          if (lastAdmin) return fail('Debe quedar al menos un administrador.');
          const hist = data.failures.filter((f) => f.reportado_por === p.id).length + data.feedback.filter((f) => f.autor === p.id).length;
          if (hist) return fail('Tiene reportes o comentarios de falla; cámbiale el rol a "Consulta" en su lugar.');
          data.assignments.filter((a) => a.profile_id === p.id).forEach((a) => void remove('assignments', a.id));
          await remove('profiles', p.id);
        } else {
          if (lastAdmin && v!.rol !== 'admin') return fail('Debe quedar al menos un administrador.');
          if (data.profiles.some((x) => x.id !== p.id && x.email.toLowerCase() === v!.email.toLowerCase())) return fail('Ese correo ya pertenece a otro perfil.');
          await update('profiles', p.id, v!);
        }
      } else {
        const { data: r, error } = await supabase!.functions.invoke('admin-manage-user', { body: { action, id: p.id, ...v } });
        // Las respuestas 4xx traen el motivo en el cuerpo de la respuesta
        let reason: string | undefined = r?.error;
        if (!reason && error && 'context' in error) reason = (await (error as { context: Response }).context.json().catch(() => null))?.error;
        if (error || r?.error) return fail(reason ?? 'No se pudo completar la acción.');
      }
      await reload();
      return true;
    } finally { setBusy(false); }
    function fail(m: string) { setMsg(m); return false; }
  };
  const save = async () => {
    const p = data.profiles.find((x) => x.id === sel);
    if (!p || !ed) return;
    if (!ed.nombre.trim() || !ed.email.trim()) return setMsg('Completa nombre y correo.');
    if (await manage('update', p, { ...ed, nombre: ed.nombre.trim(), email: ed.email.trim() })) { setMsg('Cambios guardados.'); setEd({ ...ed, nombre: ed.nombre.trim(), email: ed.email.trim() }); }
  };
  /** Solo administradores: asigna una contraseña nueva al acceso del perfil (la valida también el servidor). */
  const setPassword = async () => {
    const p = data.profiles.find((x) => x.id === sel);
    if (!p || !can()) return;
    if (pw.length < 8) return setMsg('La contraseña debe tener 8 o más caracteres.');
    if (!window.confirm(`¿Cambiar la contraseña de ${p.nombre}? La anterior dejará de funcionar.`)) return;
    setBusy(true); setMsg('');
    try {
      const { data: r, error } = await supabase!.functions.invoke('admin-manage-user', { body: { action: 'set-password', id: p.id, password: pw } });
      let reason: string | undefined = r?.error;
      if (!reason && error && 'context' in error) reason = (await (error as { context: Response }).context.json().catch(() => null))?.error;
      if (error || r?.error) return setMsg(reason ?? 'No se pudo cambiar la contraseña.');
      setPw(''); setMsg(`Contraseña de ${p.nombre} actualizada. Entrégasela por un canal seguro.`);
    } finally { setBusy(false); }
  };
  const del = async () => {
    const p = data.profiles.find((x) => x.id === sel);
    if (!p) return;
    if (!window.confirm(`¿Eliminar a ${p.nombre} (${p.email})? Perderá su acceso a GMM y sus asignaciones. No se puede deshacer.`)) return;
    if (await manage('delete', p)) { setSel(null); setEd(null); setMsg('Perfil eliminado.'); }
  };
  const mine = data.assignments.filter((a) => a.profile_id === sel);
  const label = (a: typeof mine[number]) => a.asset_id ? data.assets.find((x) => x.id === a.asset_id)?.tag || 'S/TAG' : `Área ${data.areas.find((x) => x.id === a.area_id)?.nombre}`;
  const [asgMsg, setAsgMsg] = useState('');
  const assign = async () => {
    if (!sel) return;
    if (!asg.target) return setAsgMsg(asg.kind === 'area' ? 'Elige un área de la lista.' : 'Elige un activo de la lista.');
    const dup = mine.some((a) => (asg.kind === 'area' ? a.area_id : a.asset_id) === asg.target);
    if (dup) return setAsgMsg('Esa asignación ya existe.');
    try {
      await insert('assignments', { id: uid(), profile_id: sel, asset_id: asg.kind === 'activo' ? asg.target : null, area_id: asg.kind === 'area' ? asg.target : null });
      setAsg({ ...asg, target: '' }); setAsgMsg('Asignación agregada.');
      await reload();
    } catch (e) { setAsgMsg(e instanceof Error ? `No se pudo asignar: ${e.message}` : 'No se pudo asignar.'); }
  };
  const create = async () => {
    if (!nu.nombre || !nu.email) return setMsg('Completa nombre y correo.');
    setMsg('');
    if (isDemo) await insert('profiles', { id: uid(), nombre: nu.nombre, email: nu.email, rol: nu.rol });
    else {
      const { data: r, error } = await supabase!.functions.invoke('admin-create-user', { body: nu });
      if (error || r?.error) return setMsg(r?.error ?? 'No se pudo crear el usuario.');
      setMsg('Usuario creado. Entrégale su contraseña inicial.');
    }
    setNu({ nombre: '', email: '', rol: 'supervisor', password: '' }); await reload();
  };
  return (
    <>
      <div className="top"><h1>Usuarios y asignaciones</h1></div>
      <div className={`grid g2 users ${sel ? 'has-sel' : ''}`}>
        <div className="card"><h2>Perfiles</h2>
          {sel && <button type="button" className="btn ghost sm only-mobile" style={{ marginTop: 8 }} onClick={() => { setSel(null); setEd(null); }}>← Volver a la lista de usuarios</button>}
          <table className="stack u-hide-sel"><tbody>{data.profiles.map((p) => (
            <tr key={p.id} className="click" onClick={() => pick(p)} style={{ background: sel === p.id ? 'var(--sky-100)' : undefined }}>
              <td><b>{p.nombre}</b><div className="muted">{p.email}</div></td>
              <td><select value={p.rol} onClick={(e) => e.stopPropagation()} onChange={async (e) => { const rol = e.target.value as Role; if (await manage('update', p, { nombre: p.nombre, email: p.email, rol }) && sel === p.id) setEd((x) => x && { ...x, rol }); }}><option value="admin">Admin</option><option value="mantenimiento">Mantenimiento</option><option value="supervisor">Supervisor</option><option value="consulta">Consulta</option></select></td>
              <td className="muted">{data.assignments.filter((a) => a.profile_id === p.id).length} asig.</td></tr>
          ))}</tbody></table>
          {sel && ed && <div className="form" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-1)' }}>
            <h3>Editar perfil</h3>
            <div className="grid g4">
              <label className="f">Nombre<input value={ed.nombre} onChange={(e) => setEd({ ...ed, nombre: e.target.value })} /></label>
              <label className="f">Correo<input type="email" value={ed.email} onChange={(e) => setEd({ ...ed, email: e.target.value })} /></label>
              <label className="f">Rol<select value={ed.rol} onChange={(e) => setEd({ ...ed, rol: e.target.value as Role })}><option value="admin">Admin</option><option value="mantenimiento">Mantenimiento</option><option value="supervisor">Supervisor</option><option value="consulta">Consulta</option></select></label>
            </div>
            {can() && !isDemo && <div className="row" style={{ alignItems: 'flex-end' }}>
              <label className="f" style={{ maxWidth: 260 }}>Nueva contraseña (8+)<input type="text" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
              <button className="btn sec" disabled={busy || pw.length < 8} onClick={setPassword}>Cambiar contraseña</button>
            </div>}
            <div className="row">
              <button className="btn" disabled={busy} onClick={save}>Guardar cambios</button>
              <button className="btn danger" disabled={busy || sel === me!.id} title={sel === me!.id ? 'No puedes eliminar tu propio perfil' : undefined} onClick={del}>Eliminar perfil</button>
              <button className="btn ghost" onClick={() => { setSel(null); setEd(null); }}>Cerrar</button>
            </div>
          </div>}
          <h3 className="u-hide-sel" style={{ marginTop: 16 }}>Nuevo perfil</h3>
          <div className="row u-hide-sel" style={{ marginTop: 8 }}>
            <input style={{ maxWidth: 160 }} placeholder="Nombre" value={nu.nombre} onChange={(e) => setNu({ ...nu, nombre: e.target.value })} />
            <input style={{ maxWidth: 200 }} placeholder="correo@glasstech.cl" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} />
            <select style={{ maxWidth: 140 }} value={nu.rol} onChange={(e) => setNu({ ...nu, rol: e.target.value as Role })}><option value="admin">Admin</option><option value="mantenimiento">Mantenimiento</option><option value="supervisor">Supervisor</option><option value="consulta">Consulta</option></select>
            {!isDemo && <input style={{ maxWidth: 170 }} type="text" placeholder="Contraseña inicial (8+)" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} />}
            <button className="btn sec" onClick={create}>Crear usuario</button>
          </div>
          {msg && <div className="alert" style={{ marginTop: 8 }}>{msg}</div>}
        </div>
        <div className="card"><h2>Asignaciones {sel && `· ${data.profiles.find((p) => p.id === sel)?.nombre}`}</h2>
          {!sel ? <p className="muted">Selecciona un perfil.</p> : <>
            <div className="row" style={{ margin: '12px 0' }}>
              <select style={{ maxWidth: 110 }} value={asg.kind} onChange={(e) => setAsg({ kind: e.target.value, target: '' })}><option value="area">Área</option><option value="activo">Activo</option></select>
              <select style={{ maxWidth: 260 }} value={asg.target} onChange={(e) => setAsg({ ...asg, target: e.target.value })}><option value="">—</option>
                {asg.kind === 'area' ? data.areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>) : data.assets.map((a) => <option key={a.id} value={a.id}>{a.tag || 'S/TAG'} · {a.tipo}</option>)}</select>
              <button className="btn" onClick={assign}>Asignar</button>
            </div>
            {asgMsg && <div className="alert" role="status">{asgMsg}</div>}
            <table><tbody>{mine.map((a) => <tr key={a.id}><td>{label(a)}</td><td><button className="btn ghost sm" onClick={async () => { await remove('assignments', a.id); await reload(); }}>Quitar</button></td></tr>)}</tbody></table>
          </>}
        </div>
      </div>
    </>
  );
}
