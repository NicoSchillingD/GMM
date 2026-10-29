import { Link } from 'react-router-dom';
import { useApp } from '../lib/app';
import { assetLabel } from '../lib/ui';

export default function Costs() {
  const { data } = useApp();
  const fail = (id: string | null) => data.failures.find((f) => f.id === id);
  const byAsset = new Map<string, number>();
  data.cost_docs.forEach((c) => { const f = fail(c.failure_id); if (f) byAsset.set(f.asset_id, (byAsset.get(f.asset_id) ?? 0) + c.monto); });
  const total = data.cost_docs.reduce((s, c) => s + c.monto, 0);
  return (
    <>
      <div className="top"><h1>Costos</h1></div>
      <div className="grid g2">
        <div className="card kpi"><div className="v">${total.toLocaleString('es-CL')}</div><div className="l">Total documentos asociados</div></div>
        <div className="card"><h2>Por activo</h2><table><tbody>{[...byAsset].sort((a, b) => b[1] - a[1]).map(([id, m]) => <tr key={id}><td><Link to={`/activos/${id}`}>{assetLabel(data.assets.find((a) => a.id === id))}</Link></td><td>${m.toLocaleString('es-CL')}</td></tr>)}</tbody></table></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}><h2>Documentos</h2>
        <table className="stack"><thead><tr><th>Fecha</th><th>Tipo</th><th>N°</th><th>Proveedor</th><th>Incidencia</th><th>Monto</th></tr></thead><tbody>
          {data.cost_docs.map((c) => { const f = fail(c.failure_id); return <tr key={c.id}><td>{c.fecha}</td><td>{c.tipo}</td><td>{c.numero}</td><td>{c.proveedor}</td><td>{f ? <Link to={`/fallas/${f.id}`}>{assetLabel(data.assets.find((a) => a.id === f.asset_id))}</Link> : '—'}</td><td>${c.monto.toLocaleString('es-CL')}</td></tr>; })}
          {!data.cost_docs.length && <tr><td className="muted">Agrega documentos desde el detalle de cada falla.</td></tr>}
        </tbody></table>
      </div>
    </>
  );
}
