import { useState } from 'react';
import { useApp } from '../lib/app';
import { insert, remove, uid, update } from '../lib/db';
import { assetLabel } from '../lib/ui';

const addDays = (iso: string, d: number) => new Date(new Date(iso).getTime() + d * 86400000).toISOString().slice(0, 10);

export default function Plans() {
  const { data, can, me, reload } = useApp();
  const [f, setF] = useState({ asset_id: '', nombre: '', tareas: '', frecuencia_dias: '30', proxima_fecha: new Date().toISOString().slice(0, 10), responsable: '' });
  const A = (id: string) => data.assets.find((a) => a.id === id);
  const today = new Date().toISOString().slice(0, 10);
  const add = async () => {
    if (!f.asset_id || !f.nombre) return;
    await insert('plans', { id: uid(), asset_id: f.asset_id, nombre: f.nombre, tareas: f.tareas.split('\n').map((t) => t.trim()).filter(Boolean), frecuencia_dias: Number(f.frecuencia_dias) || 30, proxima_fecha: f.proxima_fecha, responsable: f.responsable || null });
    setF({ ...f, nombre: '', tareas: '' }); await reload();
  };
  /** Genera la OT preventiva y reprograma el plan. */
  const generate = async (id: string) => {
    const p = data.plans.find((x) => x.id === id)!;
    await insert('work_orders', { id: uid(), failure_id: null, plan_id: p.id, asset_id: p.asset_id, tipo: 'preventivo', asignado_a: p.responsable, estado: 'pendiente', descripcion: `${p.nombre}\n${p.tareas.map((t) => `☐ ${t}`).join('\n')}`, creado: new Date().toISOString(), inicio: null, fin: null });
    await update('plans', p.id, { proxima_fecha: addDays(p.proxima_fecha < today ? today : p.proxima_fecha, p.frecuencia_dias) });
    await reload();
  };
  const rows = [...data.plans].sort((a, b) => a.proxima_fecha.localeCompare(b.proxima_fecha));
  return (
    <>
      <div className="top"><h1>Mantenimiento preventivo</h1></div>
      {can('mantenimiento') && <div className="card form" style={{ marginBottom: 16 }}><h2>Nuevo plan</h2>
        <div className="grid g4">
          <label className="f">Activo<select value={f.asset_id} onChange={(e) => setF({ ...f, asset_id: e.target.value })}><option value="">—</option>{data.assets.map((a) => <option key={a.id} value={a.id}>{assetLabel(a)}</option>)}</select></label>
          <label className="f">Nombre<input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></label>
          <label className="f">Cada (días)<input type="number" value={f.frecuencia_dias} onChange={(e) => setF({ ...f, frecuencia_dias: e.target.value })} /></label>
          <label className="f">Próxima fecha<input type="date" value={f.proxima_fecha} onChange={(e) => setF({ ...f, proxima_fecha: e.target.value })} /></label>
          <label className="f">Responsable<select value={f.responsable} onChange={(e) => setF({ ...f, responsable: e.target.value })}><option value="">—</option>{data.profiles.filter((p) => p.rol !== 'consulta').map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
        </div>
        <label className="f">Tareas (una por línea)<textarea value={f.tareas} onChange={(e) => setF({ ...f, tareas: e.target.value })} /></label>
        <div><button className="btn" onClick={add}>Crear plan</button></div>
      </div>}
      <div className="card"><table className="stack"><thead><tr><th>Plan</th><th>Activo</th><th>Cada</th><th>Próxima</th><th /></tr></thead><tbody>
        {rows.map((p) => <tr key={p.id}><td><b>{p.nombre}</b><div className="muted">{p.tareas.length} tareas</div></td><td>{assetLabel(A(p.asset_id))}</td><td>{p.frecuencia_dias} d</td>
          <td><span className={`badge ${p.proxima_fecha < today ? 'bad' : 'ok'}`}>{new Date(p.proxima_fecha).toLocaleDateString('es-CL')}</span></td>
          <td>{can('mantenimiento') && <div className="row"><button className="btn sm" onClick={() => generate(p.id)}>Generar OT</button><button className="btn ghost sm" onClick={async () => { await remove('plans', p.id); await reload(); }}>Eliminar</button></div>}</td></tr>)}
        {!rows.length && <tr><td className="muted">Sin planes. {me?.rol}</td></tr>}
      </tbody></table></div>
    </>
  );
}
