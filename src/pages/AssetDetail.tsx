import { Link, useParams } from 'react-router-dom';
import { useApp } from '../lib/app';
import { update } from '../lib/db';
import { AssetBadge, FailBadge, SevBadge, fmt, hrs } from '../lib/ui';
import { mtbf, mttr } from '../lib/kpi';
import type { AssetStatus } from '../lib/types';

export default function AssetDetail() {
  const { id } = useParams();
  const { data, can, reload } = useApp();
  const a = data.assets.find((x) => x.id === id);
  if (!a) return <div className="muted">Activo no encontrado. <Link to="/activos">Volver</Link></div>;
  const fs = data.failures.filter((f) => f.asset_id === a.id);
  const children = data.assets.filter((x) => x.parent_id === a.id);
  const parent = data.assets.find((x) => x.id === a.parent_id);
  const owners = data.assignments.filter((x) => x.asset_id === a.id || (x.area_id && x.area_id === a.area_id)).map((x) => data.profiles.find((p) => p.id === x.profile_id)?.nombre).filter(Boolean);
  const cost = data.cost_docs.filter((c) => fs.some((f) => f.id === c.failure_id)).reduce((s, c) => s + c.monto, 0);
  const now = new Date(); const from = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const setStatus = async (estado: AssetStatus) => { await update('assets', a.id, { estado }); await reload(); };

  return (
    <>
      <div className="top"><div><Link to="/activos">← Activos</Link><h1>{a.tag || 'S/TAG'} · {a.tipo}</h1></div>
        {can('mantenimiento') && <select style={{ maxWidth: 200 }} value={a.estado} onChange={(e) => setStatus(e.target.value as AssetStatus)}><option value="operativo">Operativo</option><option value="fuera_servicio">Fuera de servicio</option><option value="en_mantencion">En mantención</option><option value="desincorporado">Desincorporado</option></select>}
      </div>
      <div className="grid g2">
        <div className="card"><h2>Ficha</h2>
          <table><tbody>
            {([['Estado', <AssetBadge s={a.estado} />], ['Marca / modelo', `${a.marca} ${a.modelo}`], ['N° serie', a.serie || '—'], ['Fabricación', a.anio_fab ?? '—'], ['Criticidad', a.criticidad || '—'],
              ['Área', data.areas.find((x) => x.id === a.area_id)?.nombre ?? '—'], ['Padre', parent ? <Link to={`/activos/${parent.id}`}>{parent.tag}</Link> : '—'], ['Responsables', owners.join(', ') || '—'], ['Diagnóstico', a.diagnostico || '—']] as [string, React.ReactNode][]).map(([k, v]) => <tr key={k}><td className="muted">{k}</td><td>{v}</td></tr>)}
          </tbody></table>
          {can('supervisor', 'mantenimiento') && <Link className="btn accent" style={{ marginTop: 12 }} to={`/fallas/nueva?activo=${a.id}`}>Reportar falla</Link>}
        </div>
        <div className="card"><h2>Indicadores (12 meses)</h2>
          <div className="grid g4" style={{ marginTop: 12 }}>
            <div className="kpi"><div className="v">{fs.length}</div><div className="l">Fallas</div></div>
            <div className="kpi"><div className="v">{hrs(mttr(fs))}</div><div className="l">MTTR</div></div>
            <div className="kpi"><div className="v">{hrs(mtbf(fs, from, now))}</div><div className="l">MTBF</div></div>
            <div className="kpi"><div className="v">${cost.toLocaleString('es-CL')}</div><div className="l">Costo fallas</div></div>
          </div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}><h2>Componentes ({children.length})</h2>
        {children.map((c) => <div key={c.id} className="node"><Link to={`/activos/${c.id}`}>{c.tag || 'S/TAG'}</Link> {c.tipo} <AssetBadge s={c.estado} /></div>)}
        {!children.length && <p className="muted">Sin componentes anidados. Crea uno desde Activos y anídalo bajo este equipo.</p>}
      </div>
      <div className="card" style={{ marginTop: 16 }}><h2>Historial de fallas</h2>
        <table className="stack"><tbody>{fs.map((f) => <tr key={f.id}><td><Link to={`/fallas/${f.id}`}>{fmt(f.creado)}</Link></td><td>{f.descripcion}</td><td><SevBadge s={f.severidad} /></td><td><FailBadge s={f.estado} /></td></tr>)}
          {!fs.length && <tr><td className="muted">Sin fallas registradas.</td></tr>}</tbody></table>
      </div>
    </>
  );
}
