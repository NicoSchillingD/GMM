import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../lib/app';
import { insert, uid, update } from '../lib/db';
import { FAIL_STATUS, FailBadge, SevBadge, assetLabel, fmt, hrs } from '../lib/ui';
import { downtimeHours } from '../lib/kpi';
import { failureExtraFields } from '../config/failureFields';
import type { FailureStatus } from '../lib/types';

export default function FailureDetail() {
  const { id } = useParams();
  const { data, me, can, reload } = useApp();
  const f = data.failures.find((x) => x.id === id);
  const [txt, setTxt] = useState(''); const [st, setSt] = useState<FailureStatus | ''>('');
  const [cost, setCost] = useState({ tipo: 'compra' as 'compra' | 'gasto' | 'factura', numero: '', proveedor: '', monto: '' });
  if (!f) return <div className="muted">Falla no encontrada. <Link to="/fallas">Volver</Link></div>;
  const asset = data.assets.find((a) => a.id === f.asset_id);
  const fb = data.feedback.filter((x) => x.failure_id === f.id).sort((a, b) => a.creado.localeCompare(b.creado));
  const costs = data.cost_docs.filter((c) => c.failure_id === f.id);
  const who = (pid: string) => data.profiles.find((p) => p.id === pid)?.nombre ?? '—';
  const isMant = can('mantenimiento');

  const send = async () => {
    if (!txt.trim() && !st) return;
    await insert('feedback', { id: uid(), failure_id: f.id, autor: me!.id, comentario: txt.trim(), estado: st || null, creado: new Date().toISOString() });
    if (st) {
      const patch: Partial<typeof f> = { estado: st };
      if ((st === 'resuelto' || st === 'cerrado') && f.detiene_produccion && !f.liberacion) patch.liberacion = new Date().toISOString();
      await update('failures', f.id, patch);
      if (st === 'resuelto' || st === 'cerrado') await update('assets', f.asset_id, { estado: 'operativo' });
    }
    setTxt(''); setSt(''); await reload();
  };
  const addCost = async () => {
    if (!cost.monto) return;
    await insert('cost_docs', { id: uid(), tipo: cost.tipo, numero: cost.numero, proveedor: cost.proveedor, monto: Number(cost.monto), fecha: new Date().toISOString().slice(0, 10), failure_id: f.id, work_order_id: null, archivo: null });
    setCost({ ...cost, numero: '', proveedor: '', monto: '' }); await reload();
  };

  return (
    <div style={{ maxWidth: 820 }}>
      <div className="top"><div><Link to="/fallas">← Fallas</Link><h1>{assetLabel(asset)}</h1></div><div className="row"><SevBadge s={f.severidad} /><FailBadge s={f.estado} /></div></div>
      <div className="card form">
        <div className="row"><span className="muted">Reportada {fmt(f.creado)} por {who(f.reportado_por)}</span></div>
        {f.detiene_produccion && <div className="alert red">Detención desde {fmt(f.inicio_detencion)} · liberación {fmt(f.liberacion)} · {hrs(downtimeHours(f))}</div>}
        <div><b>Problema:</b> {f.descripcion}</div>
        {f.causa_inmediata && <div><b>Causa inmediata:</b> {f.causa_inmediata}</div>}
        {failureExtraFields.filter((x) => f.extra[x.key]).map((x) => <div key={x.key}><b>{x.label}:</b> {f.extra[x.key]}</div>)}
        <div className="photos">{f.fotos.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt={`Foto ${i + 1}`} /></a>)}</div>
        {asset && <Link to={`/activos/${asset.id}`}>Ver ficha del activo →</Link>}
      </div>

      <div className="card" style={{ marginTop: 16 }}><h2>Feedback de Mantenimiento</h2>
        <div className="form" style={{ marginTop: 12 }}>
          {fb.map((x) => <div key={x.id} className="card" style={{ background: 'var(--surface-alt)' }}><div className="row"><b>{who(x.autor)}</b><span className="muted">{fmt(x.creado)}</span>{x.estado && <FailBadge s={x.estado} />}</div><div>{x.comentario}</div></div>)}
          {!fb.length && <div className="muted">Aún sin respuesta del equipo de Mantenimiento.</div>}
          {(isMant || f.reportado_por === me!.id) && <>
            <textarea placeholder={isMant ? 'Diagnóstico, acción tomada, repuestos…' : 'Agregar información…'} value={txt} onChange={(e) => setTxt(e.target.value)} />
            <div className="row">
              {isMant && <select style={{ maxWidth: 220 }} value={st} onChange={(e) => setSt(e.target.value as FailureStatus | '')}><option value="">Sin cambiar estado</option>{(Object.keys(FAIL_STATUS) as FailureStatus[]).map((s) => <option key={s} value={s}>{FAIL_STATUS[s][0]}</option>)}</select>}
              <button className="btn" onClick={send}>Enviar</button>
            </div>
          </>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}><h2>Costos asociados · ${costs.reduce((s, c) => s + c.monto, 0).toLocaleString('es-CL')}</h2>
        <table className="stack"><tbody>{costs.map((c) => <tr key={c.id}><td>{c.tipo}</td><td>{c.numero}</td><td>{c.proveedor}</td><td>${c.monto.toLocaleString('es-CL')}</td></tr>)}</tbody></table>
        {isMant && <div className="row" style={{ marginTop: 12 }}>
          <select style={{ maxWidth: 120 }} value={cost.tipo} onChange={(e) => setCost({ ...cost, tipo: e.target.value as typeof cost.tipo })}><option value="compra">Compra</option><option value="gasto">Gasto</option><option value="factura">Factura</option></select>
          <input style={{ maxWidth: 130 }} placeholder="N° documento" value={cost.numero} onChange={(e) => setCost({ ...cost, numero: e.target.value })} />
          <input style={{ maxWidth: 160 }} placeholder="Proveedor" value={cost.proveedor} onChange={(e) => setCost({ ...cost, proveedor: e.target.value })} />
          <input style={{ maxWidth: 120 }} type="number" placeholder="Monto CLP" value={cost.monto} onChange={(e) => setCost({ ...cost, monto: e.target.value })} />
          <button className="btn sec" onClick={addCost}>Agregar</button>
        </div>}
      </div>
    </div>
  );
}
