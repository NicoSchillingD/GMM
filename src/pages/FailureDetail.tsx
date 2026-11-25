import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Camera, FileText, Loader2 } from 'lucide-react';
import { useApp } from '../lib/app';
import { insert, isDemo, uid, update } from '../lib/db';
import { scanInvoice } from '../lib/scanInvoice';
import { notifyEvent } from '../lib/push';
import { fmtDate, FAIL_STATUS, FailBadge, KindBadge, SevBadge, assetLabel, fmt, hrs } from '../lib/ui';
import { downtimeHours } from '../lib/kpi';
import { failureExtraFields } from '../config/failureFields';
import FailureEdit from '../components/FailureEdit';
import { deleteFailure, deletionImpact } from '../lib/failureAdmin';
import { allowedTransitions, changeStatus, isAreaOwner } from '../lib/workflow';
import type { FailureStatus } from '../lib/types';

export default function FailureDetail() {
  const { id } = useParams();
  const { data, me, can, reload } = useApp();
  const f = data.failures.find((x) => x.id === id);
  const [txt, setTxt] = useState(''); const [st, setSt] = useState<FailureStatus | ''>('');
  const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const [cost, setCost] = useState({ tipo: 'compra' as 'compra' | 'gasto' | 'factura', numero: '', proveedor: '', monto: '', fecha: today(), llegada: '' });
  const [costErr, setCostErr] = useState('');
  const [scanBusy, setScanBusy] = useState(false); const [scanMsg, setScanMsg] = useState('');
  const [err, setErr] = useState('');
  const [sol, setSol] = useState<string | null>(null); // null = sin editar: se usa la solución ya guardada
  const nav = useNavigate();
  const [editing, setEditing] = useState(false); const [delBusy, setDelBusy] = useState(false); const [delErr, setDelErr] = useState('');
  const camIn = useRef<HTMLInputElement>(null); const fileIn = useRef<HTMLInputElement>(null);
  if (!f) return <div className="muted">Falla no encontrada. <Link to="/fallas">Volver</Link></div>;
  const asset = data.assets.find((a) => a.id === f.asset_id);
  const fb = data.feedback.filter((x) => x.failure_id === f.id).sort((a, b) => a.creado.localeCompare(b.creado));
  const costs = data.cost_docs.filter((c) => c.failure_id === f.id);
  const who = (pid: string) => data.profiles.find((p) => p.id === pid)?.nombre ?? '—';
  const isMant = can('mantenimiento');
  const isAdmin = me?.rol === 'admin';
  const remove = async () => {
    const i = deletionImpact(f, data);
    const parts = [i.comentarios && `${i.comentarios} comentario(s) del historial (se borran)`, i.archivos && `${i.archivos} foto(s)/video(s) (se borran)`, i.costos && `${i.costos} documento(s) de costo (se conservan, sin vínculo a esta falla)`, i.ordenes && `${i.ordenes} orden(es) de trabajo (se conservan, sin vínculo)`].filter(Boolean);
    if (!window.confirm(`¿Eliminar definitivamente #${f.numero} · ${assetLabel(asset)}?\n\n${parts.length ? parts.join('\n') : 'No tiene comentarios, archivos ni costos asociados.'}\n\nEsta acción no se puede deshacer.`)) return;
    setDelBusy(true); setDelErr('');
    try { await deleteFailure(f, data); await reload(); nav('/fallas'); }
    catch (e) { setDelErr(e instanceof Error ? e.message : 'No se pudo eliminar.'); setDelBusy(false); }
  };

  const next = allowedTransitions(f, me, data.assets, data.assignments);
  const owner = isAreaOwner(me, f.asset_id, data.assets, data.assignments);
  const send = async () => {
    if (!txt.trim() && !st) return;
    setErr('');
    try {
      if (st) await changeStatus(f, st, me!.id, txt, f.encargado_id, st === 'resuelto' ? (sol ?? f.nota_solucion) : undefined);
      else await insert('feedback', { id: uid(), failure_id: f.id, autor: me!.id, comentario: txt.trim(), estado: null, creado: new Date().toISOString() });
    } catch (e) { return setErr(e instanceof Error ? e.message : 'No se pudo guardar.'); }
    setTxt(''); setSt(''); setSol(null); await reload();
  };
  const addCost = async () => {
    setCostErr('');
    if (!cost.monto || Number(cost.monto) <= 0) return setCostErr('Indica el monto.');
    if (!cost.fecha) return setCostErr('Indica la fecha de compra.');
    if (cost.tipo === 'compra' && !cost.llegada) return setCostErr('Indica la fecha estimada de llegada de la compra.');
    if (cost.tipo === 'compra' && cost.llegada < cost.fecha) return setCostErr('La llegada estimada no puede ser anterior a la fecha de compra.');
    try {
      await insert('cost_docs', { id: uid(), tipo: cost.tipo, numero: cost.numero, proveedor: cost.proveedor, monto: Number(cost.monto), fecha: cost.fecha, fecha_llegada: cost.tipo === 'compra' ? cost.llegada : null, failure_id: f.id, work_order_id: null, archivo: null });
      setCost({ ...cost, numero: '', proveedor: '', monto: '', fecha: today(), llegada: '' }); setScanMsg(''); await reload();
    } catch (e) { setCostErr(e instanceof Error ? e.message : 'No se pudo guardar el costo.'); }
  };
  /** Lee la factura/boleta y rellena el formulario; el usuario revisa y confirma con "Agregar". */
  const scan = async (file?: File | null) => {
    if (!file) return;
    setScanBusy(true); setScanMsg('');
    try {
      const r = await scanInvoice(file);
      setCost((c) => ({ tipo: r.tipo, numero: r.numero, proveedor: r.proveedor, monto: r.monto ? String(r.monto) : '', fecha: r.fecha || c.fecha, llegada: '' }));
      setScanMsg(`Leído${r.rut ? ` (RUT ${r.rut})` : ''}. Revisa los datos y toca "Agregar".`);
    } catch (e) { setScanMsg(e instanceof Error ? e.message : 'No se pudo leer el documento.'); }
    finally { setScanBusy(false); }
  };
  return (
    <div style={{ maxWidth: 820 }}>
      <div className="top"><div><Link to="/fallas">← Fallas</Link><h1>#{f.numero} · {assetLabel(asset)}</h1></div><div className="row"><KindBadge k={f.tipo} /><SevBadge s={f.severidad} /><FailBadge s={f.estado} /></div></div>
      {isAdmin && <div className="row" style={{ marginBottom: 12 }}><button className="btn sec sm" disabled={delBusy} onClick={() => setEditing(!editing)}>{editing ? 'Cerrar edición' : 'Editar'}</button><button className="btn danger sm" disabled={delBusy} onClick={remove}>{delBusy ? 'Eliminando…' : 'Eliminar'}</button></div>}
      {delErr && <div className="alert red" style={{ marginBottom: 12 }}>{delErr}</div>}
      {isAdmin && editing && <FailureEdit key={f.id + f.descripcion} f={f} onDone={() => setEditing(false)} />}
      <div className="card form">
        <div className="row"><span className="muted">Reportada {fmt(f.creado)} por {who(f.reportado_por)}</span></div>
        {f.detiene_produccion && <div className="alert red">Detención desde {fmt(f.inicio_detencion)} · liberación {fmt(f.liberacion)} · {hrs(downtimeHours(f))}</div>}
        <div><b>Problema:</b> {f.descripcion}</div>
        {f.causa_inmediata && <div><b>Diagnóstico inicial operacional:</b> {f.causa_inmediata}</div>}
        {failureExtraFields.filter((x) => f.extra[x.key]).map((x) => <div key={x.key}><b>{x.label}:</b> {f.extra[x.key]}</div>)}
        {!!f.videos?.length && <div className="photos">{f.videos.map((u, i) => <video key={i} src={u} controls preload="metadata" playsInline aria-label={`Video ${i + 1}`} />)}</div>}
        <div className="photos">{f.fotos.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt={`Foto ${i + 1}`} /></a>)}</div>
        {f.nota_solucion && <div className="alert ok"><b>Solución aplicada:</b> {f.nota_solucion}</div>}
        {asset && <Link to={`/activos/${asset.id}`}>Ver ficha del activo →</Link>}
      </div>

      <div className="card form" style={{ marginTop: 16 }}><h2>Gestión de Mantenimiento</h2>
        <div className="grid g4">
          <div><div className="muted">Área</div>{data.areas.find((a) => a.id === asset?.area_id)?.nombre ?? '—'}</div>
          <div><div className="muted">Fecha inicio solución</div>{fmt(f.fecha_inicio_solucion)}</div>
          <label className="f">Encargado asignado
            <select disabled={!isMant} value={f.encargado_id ?? ''} onChange={async (e) => { await update('failures', f.id, { encargado_id: e.target.value || null }); if (e.target.value) notifyEvent({ event: 'case_assigned', failure_id: f.id }); await reload(); }}>
              <option value="">Sin asignar</option>{data.profiles.filter((p) => p.rol === 'mantenimiento' || p.rol === 'admin').map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select></label>
        </div>
        <label className="f">Solución aplicada<textarea disabled={!isMant} placeholder={isMant ? 'Qué se hizo para resolverlo (se pide al marcar el caso como Resuelto)' : ''} defaultValue={f.nota_solucion} key={f.nota_solucion} onBlur={async (e) => { if (e.target.value !== f.nota_solucion) { await update('failures', f.id, { nota_solucion: e.target.value.trim() }); await reload(); } }} /></label>
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
            {st === 'resuelto' && <label className="f">Solución aplicada *<textarea value={sol ?? f.nota_solucion} onChange={(e) => setSol(e.target.value)} placeholder="Qué se hizo para resolver el problema" /></label>}
            {err && <div className="alert red">{err}</div>}
          </>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}><h2>Costos asociados · ${costs.reduce((s, c) => s + c.monto, 0).toLocaleString('es-CL')}</h2>
        {!!costs.length && <table className="stack labeled"><thead><tr><th>Tipo</th><th>N° documento</th><th>Proveedor</th><th>Fecha de compra</th><th>Llegada estimada</th><th style={{ textAlign: 'right' }}>Monto</th></tr></thead><tbody>{costs.map((c) => <tr key={c.id}><td data-label="Tipo" style={{ textTransform: 'capitalize' }}>{c.tipo}</td><td data-label="N° documento">{c.numero || '—'}</td><td data-label="Proveedor">{c.proveedor || '—'}</td><td data-label="Fecha de compra">{fmtDate(c.fecha)}</td><td data-label="Llegada estimada">{c.tipo !== 'compra' ? 'No aplica' : isMant
            ? <input type="date" aria-label={`Llegada estimada de la compra ${c.numero}`} min={c.fecha} defaultValue={c.fecha_llegada ?? ''} key={c.fecha_llegada ?? ''} style={{ minWidth: 140 }} onChange={async (e) => { if (e.target.value && e.target.value >= c.fecha) { await update('cost_docs', c.id, { fecha_llegada: e.target.value }); await reload(); } }} />
            : fmtDate(c.fecha_llegada)}</td><td data-label="Monto" style={{ textAlign: 'right' }}>${c.monto.toLocaleString('es-CL')}</td></tr>)}</tbody></table>}
        {!costs.length && <p className="muted">Aún sin costos registrados.</p>}
        {isMant && <div className="form" style={{ marginTop: 12 }}>
          {!isDemo && <div className="row">
            <button type="button" className="btn sec" disabled={scanBusy} onClick={() => camIn.current?.click()}>{scanBusy ? <Loader2 size={16} className="spin" /> : <Camera size={16} />}Escanear factura o boleta</button>
            <button type="button" className="btn ghost" disabled={scanBusy} onClick={() => fileIn.current?.click()}><FileText size={16} />Subir foto o PDF</button>
            <input ref={camIn} hidden type="file" accept="image/*" capture="environment" onChange={(e) => { void scan(e.target.files?.[0]); e.target.value = ''; }} />
            <input ref={fileIn} hidden type="file" accept="image/*,application/pdf" onChange={(e) => { void scan(e.target.files?.[0]); e.target.value = ''; }} />
          </div>}
          {scanBusy && <div className="muted">Leyendo el documento…</div>}
          {scanMsg && !scanBusy && <div className="alert">{scanMsg}</div>}
          <div className="grid g4">
            <label className="f">Tipo<select value={cost.tipo} onChange={(e) => setCost({ ...cost, tipo: e.target.value as typeof cost.tipo })}><option value="compra">Compra</option><option value="gasto">Gasto</option><option value="factura">Factura</option></select></label>
            <label className="f">N° documento<input value={cost.numero} onChange={(e) => setCost({ ...cost, numero: e.target.value })} /></label>
            <label className="f">Proveedor<input value={cost.proveedor} onChange={(e) => setCost({ ...cost, proveedor: e.target.value })} /></label>
            <label className="f">Fecha de compra *<input type="date" value={cost.fecha} onChange={(e) => setCost({ ...cost, fecha: e.target.value })} /></label>
            <label className="f">Llegada estimada{cost.tipo === 'compra' ? ' *' : ''}<input type="date" min={cost.fecha || undefined} disabled={cost.tipo !== 'compra'} title={cost.tipo !== 'compra' ? 'Solo aplica a compras' : undefined} value={cost.tipo === 'compra' ? cost.llegada : ''} onChange={(e) => setCost({ ...cost, llegada: e.target.value })} /></label>
            <label className="f">Monto CLP *<input type="number" inputMode="numeric" min="0" value={cost.monto} onChange={(e) => setCost({ ...cost, monto: e.target.value })} /></label>
          </div>
          {costErr && <div className="alert red">{costErr}</div>}
          <div className="row"><button className="btn sec" onClick={addCost}>Agregar costo</button></div>
        </div>}
      </div>
    </div>
  );
}
