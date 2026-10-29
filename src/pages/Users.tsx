import { useState } from 'react';
import { useApp } from '../lib/app';
import { insert, remove, uid, update } from '../lib/db';
import type { Role } from '../lib/types';

export default function UsersPage() {
  const { data, reload } = useApp();
  const [sel, setSel] = useState<string | null>(null);
  const [asg, setAsg] = useState({ kind: 'area', target: '' });
  const [nu, setNu] = useState({ nombre: '', email: '', rol: 'supervisor' as Role });
  const mine = data.assignments.filter((a) => a.profile_id === sel);
  const label = (a: typeof mine[number]) => a.asset_id ? data.assets.find((x) => x.id === a.asset_id)?.tag || 'S/TAG' : `Área ${data.areas.find((x) => x.id === a.area_id)?.nombre}`;
  const assign = async () => {
    if (!sel || !asg.target) return;
    await insert('assignments', { id: uid(), profile_id: sel, asset_id: asg.kind === 'activo' ? asg.target : null, area_id: asg.kind === 'area' ? asg.target : null });
    await reload();
  };
  return (
    <>
      <div className="top"><h1>Usuarios y asignaciones</h1></div>
      <div className="grid g2">
        <div className="card"><h2>Perfiles</h2>
          <table><tbody>{data.profiles.map((p) => (
            <tr key={p.id} className="click" onClick={() => setSel(p.id)} style={{ background: sel === p.id ? 'var(--sky-100)' : undefined }}>
              <td><b>{p.nombre}</b><div className="muted">{p.email}</div></td>
              <td><select value={p.rol} onClick={(e) => e.stopPropagation()} onChange={async (e) => { await update('profiles', p.id, { rol: e.target.value as Role }); await reload(); }}><option value="admin">Admin</option><option value="mantenimiento">Mantenimiento</option><option value="supervisor">Supervisor</option><option value="consulta">Consulta</option></select></td>
              <td className="muted">{data.assignments.filter((a) => a.profile_id === p.id).length} asig.</td></tr>
          ))}</tbody></table>
          <h3 style={{ marginTop: 16 }}>Nuevo perfil</h3>
          <div className="row" style={{ marginTop: 8 }}>
            <input style={{ maxWidth: 160 }} placeholder="Nombre" value={nu.nombre} onChange={(e) => setNu({ ...nu, nombre: e.target.value })} />
            <input style={{ maxWidth: 200 }} placeholder="correo@glasstech.cl" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} />
            <button className="btn sec" onClick={async () => { if (!nu.nombre || !nu.email) return; await insert('profiles', { id: uid(), ...nu }); setNu({ nombre: '', email: '', rol: 'supervisor' }); await reload(); }}>Agregar</button>
          </div>
        </div>
        <div className="card"><h2>Asignaciones {sel && `· ${data.profiles.find((p) => p.id === sel)?.nombre}`}</h2>
          {!sel ? <p className="muted">Selecciona un perfil.</p> : <>
            <div className="row" style={{ margin: '12px 0' }}>
              <select style={{ maxWidth: 110 }} value={asg.kind} onChange={(e) => setAsg({ kind: e.target.value, target: '' })}><option value="area">Área</option><option value="activo">Activo</option></select>
              <select style={{ maxWidth: 260 }} value={asg.target} onChange={(e) => setAsg({ ...asg, target: e.target.value })}><option value="">—</option>
                {asg.kind === 'area' ? data.areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>) : data.assets.map((a) => <option key={a.id} value={a.id}>{a.tag || 'S/TAG'} · {a.tipo}</option>)}</select>
              <button className="btn" onClick={assign}>Asignar</button>
            </div>
            <table><tbody>{mine.map((a) => <tr key={a.id}><td>{label(a)}</td><td><button className="btn ghost sm" onClick={async () => { await remove('assignments', a.id); await reload(); }}>Quitar</button></td></tr>)}</tbody></table>
          </>}
        </div>
      </div>
    </>
  );
}
