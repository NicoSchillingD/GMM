import { BrandStrip } from '../components/Brand';
import PushBanner from '../components/PushBanner';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useApp } from '../lib/app';
import { downtimeHours } from '../lib/kpi';
import { ASSET_STATUS, assetLabel, fmt, hrs, SevBadge, FailBadge } from '../lib/ui';
import type { AssetStatus } from '../lib/types';

export default function Dashboard() {
  const { data, can } = useApp();
  const { assets, failures, plans } = data;
  const now = new Date();
  const open = failures.filter((f) => f.estado !== 'cerrado' && f.estado !== 'resuelto');
  const stopped = open.filter((f) => f.severidad === 'urgente' && f.detiene_produccion && !f.liberacion);
  const overduePlans = plans.filter((p) => new Date(p.proxima_fecha) < now);
  const ORDER: AssetStatus[] = ['operativo', 'en_mantencion', 'fuera_servicio', 'standby', 'desincorporado'];
  const count = (st: AssetStatus) => assets.filter((a) => a.estado === st).length;
  const byArea = data.areas.map((a) => ({ a, n: failures.filter((f) => assets.find((x) => x.id === f.asset_id)?.area_id === a.id).length })).sort((x, y) => y.n - x.n);
  const max = Math.max(1, ...byArea.map((x) => x.n));
  const A = (id: string) => assets.find((a) => a.id === id);

  return (
    <>
      <BrandStrip />
      <div className="top"><h1>Dashboard</h1>{can('supervisor', 'mantenimiento') && <Link className="btn accent" to="/fallas/nueva"><Plus size={16} />Reportar falla</Link>}</div>
      <PushBanner />
      <div className="grid" style={{ marginBottom: 16 }}>
        {stopped.map((f) => <div key={f.id} className="alert red"><b>Máquina detenida:</b> {assetLabel(A(f.asset_id))} desde {fmt(f.inicio_detencion)} ({hrs(downtimeHours(f))}) · <Link to={`/fallas/${f.id}`}>ver</Link></div>)}
        {overduePlans.map((p) => <div key={p.id} className="alert">Preventivo vencido: <b>{p.nombre}</b> en {assetLabel(A(p.asset_id))} (vencía {new Date(p.proxima_fecha).toLocaleDateString('es-CL')})</div>)}
      </div>
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Link to="/activos" className="card kpi" style={{ color: 'inherit' }}><div className="v">{assets.length}</div><div className="l">Activos en total</div></Link>
        {ORDER.map((st) => <Link key={st} to={`/activos?estado=${st}`} className="card kpi" style={{ color: 'inherit' }}><div className="v">{count(st)}</div><div className="l">{ASSET_STATUS[st][0]}</div></Link>)}
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
