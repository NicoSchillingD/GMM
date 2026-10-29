import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useApp } from '../lib/app';
import { availability, downtimeHours, mtbf, mttr } from '../lib/kpi';
import { assetLabel, fmt, hrs, SevBadge, FailBadge } from '../lib/ui';

export default function Dashboard() {
  const { data, can } = useApp();
  const { assets, failures, plans, work_orders } = data;
  const now = new Date();
  const open = failures.filter((f) => f.estado !== 'cerrado' && f.estado !== 'resuelto');
  const stopped = open.filter((f) => f.severidad === 'urgente' && f.detiene_produccion && !f.liberacion);
  const overduePlans = plans.filter((p) => new Date(p.proxima_fecha) < now);
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  const last30 = failures.filter((f) => new Date(f.creado) >= from);
  const mt = mttr(last30);
  const bf = mtbf(last30, from, now, Math.max(1, assets.filter((a) => a.estado !== 'desincorporado').length));
  const av = availability(bf, mt);
  const outOfService = assets.filter((a) => a.estado === 'fuera_servicio').length;
  const byArea = data.areas.map((a) => ({ a, n: failures.filter((f) => assets.find((x) => x.id === f.asset_id)?.area_id === a.id).length })).sort((x, y) => y.n - x.n);
  const max = Math.max(1, ...byArea.map((x) => x.n));
  const A = (id: string) => assets.find((a) => a.id === id);

  return (
    <>
      <div className="top"><h1>Dashboard</h1>{can('supervisor', 'mantenimiento') && <Link className="btn accent" to="/fallas/nueva"><Plus size={16} />Reportar falla</Link>}</div>
      <div className="grid" style={{ marginBottom: 16 }}>
        {stopped.map((f) => <div key={f.id} className="alert red"><b>Máquina detenida:</b> {assetLabel(A(f.asset_id))} desde {fmt(f.inicio_detencion)} ({hrs(downtimeHours(f))}) · <Link to={`/fallas/${f.id}`}>ver</Link></div>)}
        {overduePlans.map((p) => <div key={p.id} className="alert">Preventivo vencido: <b>{p.nombre}</b> en {assetLabel(A(p.asset_id))} (vencía {new Date(p.proxima_fecha).toLocaleDateString('es-CL')})</div>)}
      </div>
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <div className="card kpi"><div className="v">{assets.length}</div><div className="l">Activos</div></div>
        <div className="card kpi"><div className="v">{outOfService}</div><div className="l">Fuera de servicio</div></div>
        <div className="card kpi"><div className="v">{open.length}</div><div className="l">Fallas abiertas</div></div>
        <div className="card kpi"><div className="v">{work_orders.filter((w) => w.estado !== 'completada').length}</div><div className="l">OT pendientes</div></div>
        <div className="card kpi"><div className="v">{hrs(mt)}</div><div className="l">MTTR 30 d</div></div>
        <div className="card kpi"><div className="v">{hrs(bf)}</div><div className="l">MTBF 30 d</div></div>
        <div className="card kpi"><div className="v">{av == null ? '—' : `${av.toFixed(1)}%`}</div><div className="l">Disponibilidad</div></div>
      </div>
      <div className="grid g2">
        <div className="card"><h2>Fallas recientes</h2>
          <table className="stack"><tbody>
            {[...failures].sort((a, b) => b.creado.localeCompare(a.creado)).slice(0, 6).map((f) => (
              <tr key={f.id} className="click"><td><Link to={`/fallas/${f.id}`}>{assetLabel(A(f.asset_id))}</Link><div className="muted">{fmt(f.creado)}</div></td><td><SevBadge s={f.severidad} /></td><td><FailBadge s={f.estado} /></td></tr>
            ))}
            {!failures.length && <tr><td className="muted">Sin fallas reportadas.</td></tr>}
          </tbody></table>
        </div>
        <div className="card"><h2>Fallas por área</h2>
          <div className="form" style={{ marginTop: 12 }}>{byArea.map(({ a, n }) => (
            <div key={a.id}><div className="row"><span>{a.nombre}</span><span className="sp" /><b>{n}</b></div><div className="bar"><i style={{ width: `${(n / max) * 100}%` }} /></div></div>
          ))}</div>
        </div>
      </div>
    </>
  );
}
