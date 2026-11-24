import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useApp } from '../lib/app';
import { FAIL_STATUS, FailBadge, KindBadge, SevBadge, assetLabel, fmt } from '../lib/ui';

export default function Failures() {
  const { data, can, me } = useApp();
  const [st, setSt] = useState(''); const [sev, setSev] = useState(''); const [kind, setKind] = useState('');
  const rows = [...data.failures].filter((f) => (!st || f.estado === st) && (!sev || f.severidad === sev) && (!kind || (f.tipo ?? 'falla') === kind)).sort((a, b) => b.creado.localeCompare(a.creado));
  return (
    <>
      <div className="top"><h1>Fallas y hallazgos</h1>{can('supervisor', 'mantenimiento') && <Link className="btn accent" to="/fallas/nueva"><Plus size={16} />Reportar</Link>}</div>
      <div className="card row" style={{ marginBottom: 16 }}>
        <select style={{ maxWidth: 200 }} value={st} onChange={(e) => setSt(e.target.value)}><option value="">Todos los estados</option>{(Object.keys(FAIL_STATUS) as (keyof typeof FAIL_STATUS)[]).map((k) => <option key={k} value={k}>{FAIL_STATUS[k][0]}</option>)}</select>
        <select style={{ maxWidth: 200 }} value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Fallas y hallazgos</option><option value="falla">Fallas</option><option value="hallazgo">Hallazgos</option></select>
        <select style={{ maxWidth: 200 }} value={sev} onChange={(e) => setSev(e.target.value)}><option value="">Toda severidad</option><option value="urgente">Urgente</option><option value="informativo">Informativo</option></select>
      </div>
      <div className="card"><table className="stack"><thead><tr><th>N°</th><th>Fecha</th><th>Área</th><th>Equipo</th><th>Descripción</th><th>Clase</th><th>Tipo</th><th>Status</th><th>Encargado</th></tr></thead><tbody>
        {rows.map((f) => (
          <tr key={f.id} className="click"><td><Link to={`/fallas/${f.id}`}>{f.numero}</Link></td><td>{fmt(f.creado)}</td><td>{data.areas.find((x) => x.id === data.assets.find((a) => a.id === f.asset_id)?.area_id)?.nombre}</td><td>{assetLabel(data.assets.find((a) => a.id === f.asset_id))}</td><td>{f.descripcion.slice(0, 80)}</td><td><KindBadge k={f.tipo} /></td><td><SevBadge s={f.severidad} /></td><td><FailBadge s={f.estado} /></td><td>{data.profiles.find((p) => p.id === f.encargado_id)?.nombre ?? '—'}{f.reportado_por === me?.id && ' · (reportada por mí)'}</td></tr>
        ))}
        {!rows.length && <tr><td className="muted">Sin resultados.</td></tr>}
      </tbody></table></div>
    </>
  );
}
