import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useApp } from '../lib/app';
import { FailBadge, SevBadge, assetLabel, fmt } from '../lib/ui';

export default function Failures() {
  const { data, can, me } = useApp();
  const [st, setSt] = useState(''); const [sev, setSev] = useState('');
  const rows = [...data.failures].filter((f) => (!st || f.estado === st) && (!sev || f.severidad === sev)).sort((a, b) => b.creado.localeCompare(a.creado));
  return (
    <>
      <div className="top"><h1>Fallas</h1>{can('supervisor', 'mantenimiento') && <Link className="btn accent" to="/fallas/nueva"><Plus size={16} />Reportar falla</Link>}</div>
      <div className="card row" style={{ marginBottom: 16 }}>
        <select style={{ maxWidth: 200 }} value={st} onChange={(e) => setSt(e.target.value)}><option value="">Todos los estados</option><option value="abierto">Abierto</option><option value="en_revision">En revisión</option><option value="en_curso">En curso</option><option value="resuelto">Resuelto</option><option value="cerrado">Cerrado</option></select>
        <select style={{ maxWidth: 200 }} value={sev} onChange={(e) => setSev(e.target.value)}><option value="">Toda severidad</option><option value="urgente">Urgente</option><option value="informativo">Informativo</option></select>
      </div>
      <div className="card"><table className="stack"><thead><tr><th>Fecha</th><th>Activo</th><th>Problema</th><th>Severidad</th><th>Estado</th><th>Reporta</th></tr></thead><tbody>
        {rows.map((f) => (
          <tr key={f.id} className="click"><td><Link to={`/fallas/${f.id}`}>{fmt(f.creado)}</Link></td><td>{assetLabel(data.assets.find((a) => a.id === f.asset_id))}</td><td>{f.descripcion.slice(0, 80)}</td><td><SevBadge s={f.severidad} /></td><td><FailBadge s={f.estado} /></td><td>{data.profiles.find((p) => p.id === f.reportado_por)?.nombre}{f.reportado_por === me?.id && ' (yo)'}</td></tr>
        ))}
        {!rows.length && <tr><td className="muted">Sin resultados.</td></tr>}
      </tbody></table></div>
    </>
  );
}
