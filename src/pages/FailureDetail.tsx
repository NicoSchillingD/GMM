import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Camera, FileText, Loader2 } from 'lucide-react';
import { useApp } from '../lib/app';
import { insert, isDemo, uid, update } from '../lib/db';
import { scanInvoice } from '../lib/scanInvoice';
import { FAIL_STATUS, FailBadge, KindBadge, SevBadge, assetLabel, fmt, hrs } from '../lib/ui';
import { downtimeHours } from '../lib/kpi';
import { failureExtraFields } from '../config/failureFields';
import { allowedTransitions, changeStatus, isAreaOwner } from '../lib/workflow';
import type { FailureStatus } from '../lib/types';

export default function FailureDetail() {
  const { id } = useParams();
  const { data, me, can, reload } = useApp();
  const f = data.failures.find((x) => x.id === id);
  const [txt, setTxt] = useState(''); const [st, setSt] = useState<FailureStatus | ''>('');
  const [cost, setCost] = useState({ tipo: 'compra' as 'compra' | 'gasto' | 'factura', numero: '', proveedor: '', monto: '', fecha: '' });
  const [scanBusy, setScanBusy] = useState(false); const [scanMsg, setScanMsg] = useState('');
  const camIn = useRef<HTMLInputElement>(null); const fileIn = useRef<HTMLInputElement>(null);
  if (!f) return <div className="muted">Falla no encontrada. <Link to="/fallas">Volver</Link></div>;
  const asset = data.assets.find((a) => a.id === f.asset_id);
  const fb = data.feedback.filter((x) => x.failure_id === f.id).sort((a, b) => a.creado.localeCompare(b.creado));
  const costs = data.cost_docs.filter((c) => c.failure_id === f.id);
  const who = (pid: string) => data.profiles.find((p) => p.id === pid)?.nombre ?? '—';
  const isMant = can('mantenimiento');

  const next = allowedTransitions(f, me, data.assets, data.assignments);
  const owner = isAreaOwner(me, f.asset_id, data.assets, data.assignments);
  const [err, setErr] = useState('');
  const send = async () => {
    if (!txt.trim() && !st) return;
    setErr('');
    try {
      if (st) await changeStatus(f, st, me!.id, txt, f.encargado_id);
      else await insert('feedback', { id: uid(), failure_id: f.id, autor: me!.id, comentario: txt.trim(), estado: null, creado: new Date().toISOString() });
    } catch (e) { return setErr(e instanceof Error ? e.message : 'No se pudo guardar.'); }
    setTxt(''); setSt(''); await reload();
  };
  const addCost = async () => {
    if (!cost.monto) return;
    await insert('cost_docs', { id: uid(), tipo: cost.tipo, numero: cost.numero, proveedor: cost.proveedor, monto: Number(cost.monto), fecha: cost.fecha || new Date().toISOString().slice(0, 10), failure_id: f.id, work_order_id: null, archivo: null });
    setCost({ ...cost, numero: '', proveedor: '', monto: '', fecha: '' }); setScanMsg(''); await reload();
  };
  /** Lee la factura/boleta y rellena el formulario; el usuario revisa y confirma con "Agregar". */
  const scan = async (file?: File | null) => {
    if (!file) return;
    setScanBusy(true); setScanMsg('');
    try {
      const r = await scanInvoice(file);
      setCost({ tipo: r.tipo, numero: r.numero, proveedor: r.proveedor, monto: r.monto ? String(r.monto) : '', fecha: r.fecha });
      setScanMsg(`Leído${r.rut ? ` (RUT ${r.rut})` : ''}. Revisa los datos y toca "Agregar".`);
    } catch (e) { setScanMsg(e instanceof Error ? e.message : 'No se pudo leer el documento.'); }
    finally { setScanBusy(false); }
  };
  return (
    <div style={{ maxWidth: 820 }}>
      <div className="top"><div><Link to="/fallas">← Fallas</Link><h1>#{f.numero} · {assetLabel(asset)}</h1></div><div className="row"><KindBadge k={f.tipo} /><SevBadge s={f.severidad} /><FailBadge s={f.estado} /></div></div>
      <div className="card form">
        <div className="row"><span className="muted">Reportada {fmt(f.creado)} por {who(f.reportado_por)}</span></div>
        {f.detiene_produccion && <div className="alert red">Detención desde {fmt(f.inicio_detencion)} · liberación {fmt(f.liberacion)} · {hrs(downtimeHours(f))}</div>}
        <div><b>Problema:</b> {f.descripcion}</div>
        {f.causa_inmediata && <div><b>Causa inmediata:</b> {f.causa_inmediata}</div>}
        {failureExtraFields.filter((x) => f.extra[x.key]).map((x) => <div key={x.key}><b>{x.label}:</b> {f.extra[x.key]}</div>)}
        <div className="photos">{f.fotos.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt={`Foto ${i + 1}`} /></a>)}</div>
        {asset && <Link to={`/activos/${asset.id}`}>Ver ficha del activo →</Link>}
      </div>

      <div className="card form" style={{ marginTop: 16 }}><h2>Gestión de Mantenimiento</h2>
        <div className="grid g4">
          <div><div className="muted">Área</div>{data.areas.find((a) => a.id === asset?.area_id)?.nombre ?? '—'}</div>
          <div><div className="muted">Fecha inicio solución</div>{fmt(f.fecha_inicio_solucion)}</div>
          <label className="f">Encargado asignado
            <select disabled={!isMant} value={f.encargado_id ?? ''} onChange={async (e) => { await update('failures', f.id, { encargado_id: e.target.value || null }); await reload(); }}>
              <option value="">Sin asignar</option>{data.profiles.filter((p) => p.rol === 'mantenimiento' || p.rol === 'admin').map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select></label>
        </div>
        <label className="f">Nota status<textarea disabled={!isMant} defaultValue={f.nota_status} onBlur={async (e) => { if (e.target.value !== f.nota_status) { await update('failures', f.id, { nota_status: e.target.value }); await reload(); } }} /></label>
        <label className="f">Nota solución<textarea disabled={!isMant} defaultValue={f.nota_solucion} onBlur={async (e) => { if (e.target.value !== f.nota_solucion) { await update('failures', f.id, { nota_solucion: e.target.value }); await reload(); } }} /></label>
      </div>

      <div className="card" style={{ marginTop: 16 }}><h2>Historial y comentarios</h2>
        <div className="form" style={{ marginTop: 12 }}>
          {fb.map((x) => <div key={x.id} className="card" style={{ background: 'var(--surface-alt)' }}><div className="row"><b>{who(x.autor)}</b><span className="muted">{fmt(x.creado)}</span>{x.estado && <FailBadge s={x.estado} />}</div><div>{x.comentario}</div></div>)}
          {!fb.length && <div className="muted">Aún sin comentarios.</div>}
          {(isMant || owner || f.reportado_por === me!.id) && <>
            <textarea placeholder={isMant ? 'Diagnóstico, acción tomada, repuestos…' : owner ? 'Comentario de validación…' : 'Agregar información…'} value={txt} onChange={(e) => setTxt(e.target.value)} />
            <div className="row">
              {next.length > 0 && <select style={{ maxWidth: 240 }} value={st} onChange={(e) => setSt(e.target.value as FailureStatus | '')}><option value="">Sin cambiar estado</option>{next.map((s) => <option key={s} value={s}>Pasar a {FAIL_STATUS[s][0]}</option>)}</select>}
              <button className="btn" onClick={send}>Enviar</button>
            </div>
            {err && <div className="alert red">{err}</div>}
          </>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}><h2>Costos asociados · ${costs.reduce((s, c) => s + c.monto, 0).toLocaleString('es-CL')}</h2>
        <table className="stack"><tbody>{costs.map((c) => <tr key={c.id}><td>{c.tipo}</td><td>{c.numero}</td><td>{c.proveedor}</td><td>${c.monto.toLocaleString('es-CL')}</td></tr>)}</tbody></table>
        {isMant && <div className="form" style={{ marginTop: 12 }}>
          {!isDemo && <div className="row">
            <button type="button" className="btn sec" disabled={scanBusy} onClick={() => camIn.current?.click()}>{scanBusy ? <Loader2 size={16} className="spin" /> : <Camera size={16} />}Escanear factura o boleta</button>
            <button type="button" className="btn ghost" disabled={scanBusy} onClick={() => fileIn.current?.click()}><FileText size={16} />Subir foto o PDF</button>
            <input ref={camIn} hidden type="file" accept="image/*" capture="environment" onChange={(e) => { void scan(e.target.files?.[0]); e.target.value = ''; }} />
            <input ref={fileIn} hidden type="file" accept="image/*,application/pdf" onChange={(e) => { void scan(e.target.files?.[0]); e.target.value = ''; }} />
          </div>}
          {scanBusy && <div className="muted">Leyendo el documento…</div>}
          {scanMsg && !scanBusy && <div className="alert">{scanMsg}</div>}
          <div className="row">
          <select style={{ maxWidth: 120 }} value={cost.tipo} onChange={(e) => setCost({ ...cost, tipo: e.target.value as typeof cost.tipo })}><option value="compra">Compra</option><option value="gasto">Gasto</option><option value="factura">Factura</option></select>
          <input style={{ maxWidth: 130 }} placeholder="N° documento" value={cost.numero} onChange={(e) => setCost({ ...cost, numero: e.target.value })} />
          <input style={{ maxWidth: 160 }} placeholder="Proveedor" value={cost.proveedor} onChange={(e) => setCost({ ...cost, proveedor: e.target.value })} />
          <input style={{ maxWidth: 150 }} type="date" aria-label="Fecha del documento" value={cost.fecha} onChange={(e) => setCost({ ...cost, fecha: e.target.value })} />
          <input style={{ maxWidth: 120 }} type="number" placeholder="Monto CLP" value={cost.monto} onChange={(e) => setCost({ ...cost, monto: e.target.value })} />
          <button className="btn sec" onClick={addCost}>Agregar</button>
          </div>
        </div>}
      </div>
    </div>
  );
}
