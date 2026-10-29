import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useApp } from '../lib/app';
import { insert, uid, update } from '../lib/db';
import { AssetBadge, Badge } from '../lib/ui';
import type { Asset, AssetStatus } from '../lib/types';

const blank = (): Asset => ({ id: uid(), parent_id: null, area_id: null, tag: '', tipo: '', marca: '', modelo: '', serie: '', anio_fab: null, estado: 'operativo', criticidad: '', diagnostico: '', es_componente: false });

export default function Assets() {
  const { data, can, reload } = useApp();
  const [q, setQ] = useState(''); const [area, setArea] = useState(''); const [st, setSt] = useState('');
  const [edit, setEdit] = useState<Asset | null>(null);
  const [view, setView] = useState<'arbol' | 'tabla'>('arbol');
  const match = (a: Asset) => (!area || a.area_id === area) && (!st || a.estado === st)
    && (!q || `${a.tag} ${a.tipo} ${a.marca} ${a.modelo} ${a.serie}`.toLowerCase().includes(q.toLowerCase()));
  const kids = useMemo(() => {
    const m = new Map<string | null, Asset[]>();
    data.assets.forEach((a) => m.set(a.parent_id, [...(m.get(a.parent_id) ?? []), a]));
    return m;
  }, [data.assets]);
  const filtering = !!(q || area || st);

  const Node = ({ a }: { a: Asset }) => {
    const c = kids.get(a.id) ?? [];
    return (
      <li>
        <div className="node">
          <Link to={`/activos/${a.id}`}><b>{a.tag || 'S/TAG'}</b></Link>
          <span>{a.tipo} {a.marca} {a.modelo}</span><AssetBadge s={a.estado} />
          {a.criticidad && <Badge t={a.criticidad} c="info" />}
          {a.es_componente && <Badge t="componente" />}
        </div>
        {c.length > 0 && <ul>{c.map((x) => <Node key={x.id} a={x} />)}</ul>}
      </li>
    );
  };

  const save = async () => {
    if (!edit) return;
    const exists = data.assets.some((a) => a.id === edit.id);
    if (exists) await update('assets', edit.id, edit); else await insert('assets', edit);
    setEdit(null); await reload();
  };
  const areaName = (id: string | null) => data.areas.find((a) => a.id === id)?.nombre ?? '—';
  const roots = (kids.get(null) ?? []);

  return (
    <>
      <div className="top"><h1>Activos</h1>
        <div className="row">
          <button className="btn sec" onClick={() => setView(view === 'arbol' ? 'tabla' : 'arbol')}>{view === 'arbol' ? 'Ver tabla' : 'Ver árbol'}</button>
          {can('mantenimiento') && <button className="btn accent" onClick={() => setEdit(blank())}><Plus size={16} />Nuevo activo / componente</button>}
        </div>
      </div>
      <div className="card row" style={{ marginBottom: 16 }}>
        <input style={{ maxWidth: 260 }} placeholder="Buscar TAG, tipo, marca…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select style={{ maxWidth: 200 }} value={area} onChange={(e) => setArea(e.target.value)}><option value="">Todas las áreas</option>{data.areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select>
        <select style={{ maxWidth: 200 }} value={st} onChange={(e) => setSt(e.target.value)}><option value="">Todos los estados</option><option value="operativo">Operativo</option><option value="fuera_servicio">Fuera de servicio</option><option value="en_mantencion">En mantención</option><option value="desincorporado">Desincorporado</option></select>
        <span className="muted">{data.assets.filter(match).length} de {data.assets.length}</span>
      </div>

      {edit && (
        <div className="card form" style={{ marginBottom: 16 }}>
          <h2>{data.assets.some((a) => a.id === edit.id) ? 'Editar activo' : 'Nuevo activo'}</h2>
          <div className="grid g4">
            {(['tag', 'tipo', 'marca', 'modelo', 'serie'] as const).map((k) => <label key={k} className="f">{k.toUpperCase()}<input value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} /></label>)}
            <label className="f">Año fabricación<input type="number" value={edit.anio_fab ?? ''} onChange={(e) => setEdit({ ...edit, anio_fab: e.target.value ? Number(e.target.value) : null })} /></label>
            <label className="f">Criticidad<input value={edit.criticidad} placeholder="A1…C3" onChange={(e) => setEdit({ ...edit, criticidad: e.target.value })} /></label>
            <label className="f">Área<select value={edit.area_id ?? ''} onChange={(e) => setEdit({ ...edit, area_id: e.target.value || null })}><option value="">—</option>{data.areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></label>
            <label className="f">Estado<select value={edit.estado} onChange={(e) => setEdit({ ...edit, estado: e.target.value as AssetStatus })}><option value="operativo">Operativo</option><option value="fuera_servicio">Fuera de servicio</option><option value="en_mantencion">En mantención</option><option value="desincorporado">Desincorporado</option></select></label>
            <label className="f">Anidar bajo<select value={edit.parent_id ?? ''} onChange={(e) => setEdit({ ...edit, parent_id: e.target.value || null })}><option value="">(ninguno · activo raíz)</option>{data.assets.filter((a) => a.id !== edit.id).map((a) => <option key={a.id} value={a.id}>{a.tag || 'S/TAG'} · {a.tipo}</option>)}</select></label>
          </div>
          <label className="f">Diagnóstico / notas<textarea value={edit.diagnostico} onChange={(e) => setEdit({ ...edit, diagnostico: e.target.value })} /></label>
          <label className="row"><input type="checkbox" style={{ width: 'auto' }} checked={edit.es_componente} onChange={(e) => setEdit({ ...edit, es_componente: e.target.checked })} />Es un componente (parte de otro activo)</label>
          <div className="row"><button className="btn" onClick={save}>Guardar</button><button className="btn ghost" onClick={() => setEdit(null)}>Cancelar</button></div>
        </div>
      )}

      <div className="card">
        {view === 'arbol' && !filtering ? (
          <div className="tree">
            {data.areas.map((ar) => {
              const rs = roots.filter((a) => a.area_id === ar.id);
              return rs.length ? <details key={ar.id} open><summary style={{ cursor: 'pointer', padding: '6px 0' }}><h3 style={{ display: 'inline' }}>{ar.nombre} <span className="muted">({rs.length})</span></h3></summary><ul>{rs.map((a) => <Node key={a.id} a={a} />)}</ul></details> : null;
            })}
            {roots.filter((a) => !a.area_id).length > 0 && <ul>{roots.filter((a) => !a.area_id).map((a) => <Node key={a.id} a={a} />)}</ul>}
          </div>
        ) : (
          <table className="stack"><thead><tr><th>TAG</th><th>Equipo</th><th>Área</th><th>Estado</th><th>Crit.</th><th /></tr></thead><tbody>
            {data.assets.filter(match).map((a) => (
              <tr key={a.id}><td><Link to={`/activos/${a.id}`}><b>{a.tag || 'S/TAG'}</b></Link></td><td>{a.tipo} {a.marca} {a.modelo}</td><td>{areaName(a.area_id)}</td><td><AssetBadge s={a.estado} /></td><td>{a.criticidad}</td>
                <td>{can('mantenimiento') && <button className="btn ghost sm" onClick={() => setEdit(a)}>Editar</button>}</td></tr>
            ))}
          </tbody></table>
        )}
      </div>
    </>
  );
}
