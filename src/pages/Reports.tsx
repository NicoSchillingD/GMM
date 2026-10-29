import { useState } from 'react';
import { Download } from 'lucide-react';
import { useApp } from '../lib/app';
import { availability, downtimeHours, mtbf, mttr } from '../lib/kpi';
import { assetLabel, hrs } from '../lib/ui';

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function Reports() {
  const { data } = useApp();
  const [from, setFrom] = useState(iso(new Date(Date.now() - 90 * 86400000)));
  const [to, setTo] = useState(iso(new Date()));
  const [area, setArea] = useState('');
  const f0 = new Date(from), t0 = new Date(`${to}T23:59:59`);
  const inArea = (assetId: string) => !area || data.assets.find((a) => a.id === assetId)?.area_id === area;
  const fs = data.failures.filter((f) => { const d = new Date(f.creado); return d >= f0 && d <= t0 && inArea(f.asset_id); });
  const nAssets = Math.max(1, data.assets.filter((a) => a.estado !== 'desincorporado' && (!area || a.area_id === area)).length);
  const M = mttr(fs), B = mtbf(fs, f0, t0, nAssets), D = availability(B, M);
  const costOf = (fid: string) => data.cost_docs.filter((c) => c.failure_id === fid).reduce((s, c) => s + c.monto, 0);

  const rows = data.assets.map((a) => {
    const x = fs.filter((f) => f.asset_id === a.id);
    return { a, n: x.length, down: x.reduce((s, f) => s + downtimeHours(f), 0), mttr: mttr(x), mtbf: mtbf(x, f0, t0, 1), cost: x.reduce((s, f) => s + costOf(f.id), 0) };
  }).filter((r) => r.n).sort((x, y) => y.n - x.n);
  const totalN = rows.reduce((s, r) => s + r.n, 0) || 1;
  let acc = 0;

  const csv = () => {
    const head = 'TAG,Equipo,Fallas,Detencion_h,MTTR_h,MTBF_h,Costo_CLP';
    const body = rows.map((r) => [r.a.tag, `${r.a.tipo} ${r.a.marca}`, r.n, r.down.toFixed(1), r.mttr?.toFixed(1) ?? '', r.mtbf?.toFixed(1) ?? '', r.cost].join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([`${head}\n${body}`], { type: 'text/csv' }));
    Object.assign(document.createElement('a'), { href: url, download: `gmm-reporte-${from}_${to}.csv` }).click();
  };

  return (
    <>
      <div className="top"><h1>Reportes</h1><button className="btn sec" onClick={csv}><Download size={16} />Exportar CSV</button></div>
      <div className="card row" style={{ marginBottom: 16 }}>
        <label className="f">Desde<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="f">Hasta<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label className="f">Área<select value={area} onChange={(e) => setArea(e.target.value)}><option value="">Todas</option>{data.areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></label>
      </div>
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <div className="card kpi"><div className="v">{fs.length}</div><div className="l">Fallas</div></div>
        <div className="card kpi"><div className="v">{hrs(M)}</div><div className="l">MTTR</div></div>
        <div className="card kpi"><div className="v">{hrs(B)}</div><div className="l">MTBF</div></div>
        <div className="card kpi"><div className="v">{D == null ? '—' : `${D.toFixed(1)}%`}</div><div className="l">Disponibilidad</div></div>
        <div className="card kpi"><div className="v">{hrs(rows.reduce((s, r) => s + r.down, 0))}</div><div className="l">Horas detenidas</div></div>
        <div className="card kpi"><div className="v">${rows.reduce((s, r) => s + r.cost, 0).toLocaleString('es-CL')}</div><div className="l">Costo</div></div>
      </div>
      <div className="card"><h2>Pareto de fallas por activo</h2>
        <table className="stack"><thead><tr><th>Activo</th><th>Fallas</th><th>% acum.</th><th>Detención</th><th>MTTR</th><th>MTBF</th><th>Costo</th></tr></thead><tbody>
          {rows.map((r) => { acc += r.n; return <tr key={r.a.id}><td>{assetLabel(r.a)}</td><td>{r.n}</td><td><div className="bar" style={{ minWidth: 80 }}><i style={{ width: `${(acc / totalN) * 100}%` }} /></div>{((acc / totalN) * 100).toFixed(0)}%</td><td>{hrs(r.down)}</td><td>{hrs(r.mttr)}</td><td>{hrs(r.mtbf)}</td><td>${r.cost.toLocaleString('es-CL')}</td></tr>; })}
          {!rows.length && <tr><td className="muted">Sin fallas en el periodo.</td></tr>}
        </tbody></table>
      </div>
    </>
  );
}
