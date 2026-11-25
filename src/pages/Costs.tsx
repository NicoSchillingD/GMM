import { Top } from '../components/Brand';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/app';
import { assetLabel, fmtDate } from '../lib/ui';

export default function Costs() {
  const { data } = useApp();
  const fail = (id: string | null) => data.failures.find((f) => f.id === id);
  const byAsset = new Map<string, number>();
  data.cost_docs.forEach((c) => { const f = fail(c.failure_id); if (f) byAsset.set(f.asset_id, (byAsset.get(f.asset_id) ?? 0) + c.monto); });
  const total = data.cost_docs.reduce((s, c) => s + c.monto, 0);
  return (
    <>
      <Top><h1>Costos</h1></Top>
      <div className="grid g2">
        <div className="card kpi"><div className="v">${total.toLocaleString('es-CL')}</div><div className="l">Total documentos asociados</div></div>
        <div className="card"><h2>Por activo</h2><table><tbody>{[...byAsset].sort((a, b) => b[1] - a[1]).map(([id, m]) => <tr key={id}><td><Link to={`/activos/${id}`}>{assetLabel(data.assets.find((a) => a.id === id))}</Link></td><td>${m.toLocaleString('es-CL')}</td></tr>)}</tbody></table></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}><h2>Documentos</h2>
        <table className="stack labeled"><thead><tr><th>Fecha de compra</th><th>Llegada estimada</th><th>Tipo</th><th>N° documento</th><th>Proveedor</th><th>Falla / hallazgo</th><th style={{ textAlign: 'right' }}>Monto</th></tr></thead><tbody>
          {data.cost_docs.map((c) => { const f = fail(c.failure_id); return <tr key={c.id}><td data-label="Fecha de compra">{fmtDate(c.fecha)}</td><td data-label="Llegada estimada">{c.tipo === 'compra' ? fmtDate(c.fecha_llegada) : 'No aplica'}</td><td data-label="Tipo" style={{ textTransform: 'capitalize' }}>{c.tipo}</td><td data-label="N° documento">{c.numero || '—'}</td><td data-label="Proveedor">{c.proveedor || '—'}</td><td data-label="Falla / hallazgo">{f ? <Link to={`/fallas/${f.id}`}>#{f.numero} · {assetLabel(data.assets.find((a) => a.id === f.asset_id))}</Link> : '—'}</td><td data-label="Monto" style={{ textAlign: 'right' }}>${c.monto.toLocaleString('es-CL')}</td></tr>; })}
          {!data.cost_docs.length && <tr><td className="muted">Agrega documentos desde el detalle de cada falla.</td></tr>}
        </tbody></table>
      </div>
    </>
  );
}
