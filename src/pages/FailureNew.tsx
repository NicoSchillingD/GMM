import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Camera, Image as ImageIcon, X } from 'lucide-react';
import { useApp } from '../lib/app';
import { insert, uid, isDemo, supabase } from '../lib/db';
import { assetLabel, compressImage } from '../lib/ui';
import { failureExtraFields } from '../config/failureFields';
import { notifyLocal, askNotifyPermission } from '../lib/notify';
import type { Failure, Severity } from '../lib/types';

const nowLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function FailureNew() {
  const { data, me, reload } = useApp();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const mine = useMemo(() => {
    const ids = new Set(data.assignments.filter((x) => x.profile_id === me!.id).flatMap((x) => (x.asset_id ? [x.asset_id] : data.assets.filter((a) => a.area_id === x.area_id).map((a) => a.id))));
    return ids;
  }, [data, me]);
  const [onlyMine, setOnlyMine] = useState(me!.rol === 'supervisor');
  const [q, setQ] = useState('');
  const [assetId, setAssetId] = useState(sp.get('activo') ?? '');
  const [sev, setSev] = useState<Severity>('informativo');
  const [desc, setDesc] = useState(''); const [causa, setCausa] = useState('');
  const [inicio, setInicio] = useState(nowLocal());
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [fotos, setFotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const cam = useRef<HTMLInputElement>(null); const gal = useRef<HTMLInputElement>(null);

  const options = data.assets.filter((a) => (!onlyMine || mine.has(a.id)) && (!q || `${a.tag} ${a.tipo} ${a.marca}`.toLowerCase().includes(q.toLowerCase())));
  const addFiles = async (fl: FileList | null) => {
    if (!fl) return;
    const imgs = await Promise.all([...fl].map((f) => compressImage(f)));
    setFotos((p) => [...p, ...imgs]);
  };

  const submit = async () => {
    if (!assetId) return setErr('Selecciona el activo o componente.');
    if (!desc.trim()) return setErr('Describe el problema.');
    for (const f of failureExtraFields) if (f.required && !extra[f.key]) return setErr(`Falta: ${f.label}`);
    setBusy(true); setErr('');
    try {
      const urgent = sev === 'urgente';
      const id = uid();
      let urls = fotos;
      if (supabase) {
        urls = await Promise.all(fotos.map(async (d, i) => {
          const blob = await (await fetch(d)).blob();
          const path = `${id}/${i}.jpg`;
          const { error } = await supabase!.storage.from('failure-photos').upload(path, blob, { contentType: 'image/jpeg' });
          if (error) throw error;
          return supabase!.storage.from('failure-photos').getPublicUrl(path).data.publicUrl;
        }));
      }
      const row: Failure = {
        id, asset_id: assetId, reportado_por: me!.id, severidad: sev, detiene_produccion: urgent,
        inicio_detencion: urgent ? new Date(inicio).toISOString() : null, liberacion: null,
        descripcion: desc.trim(), causa_inmediata: causa.trim(), extra, estado: 'abierto', fotos: urls, creado: new Date().toISOString(),
      };
      await insert('failures', row);
      if (urgent) { await askNotifyPermission(); notifyLocal('Falla URGENTE', assetLabel(data.assets.find((a) => a.id === assetId))); }
      await reload();
      nav(`/fallas/${id}`);
    } catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo guardar'); } finally { setBusy(false); }
  };

  return (
    <div style={{ maxWidth: 680 }}>
      <div className="top"><div><Link to="/fallas">← Fallas</Link><h1>Reportar falla</h1></div></div>
      <div className="card form">
        <div className="sev">
          <button type="button" className={`u ${sev === 'urgente' ? 'on' : ''}`} onClick={() => setSev('urgente')}><b>Urgente</b><span className="muted">Máquina detenida</span></button>
          <button type="button" className={`i ${sev === 'informativo' ? 'on' : ''}`} onClick={() => setSev('informativo')}><b>Informativo</b><span className="muted">Sin pérdida de tiempo productivo</span></button>
        </div>
        <label className="f">Activo / componente
          <input placeholder="Buscar por TAG, tipo o marca…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select size={5} value={assetId} onChange={(e) => setAssetId(e.target.value)} style={{ height: 150 }}>
            {options.map((a) => <option key={a.id} value={a.id}>{assetLabel(a)}{a.parent_id ? ' (componente)' : ''}</option>)}
          </select>
        </label>
        {me!.rol === 'supervisor' && <label className="row"><input type="checkbox" style={{ width: 'auto' }} checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />Solo mis activos asignados ({mine.size})</label>}
        {sev === 'urgente' && <label className="f">Inicio de la detención<input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} /></label>}
        <label className="f">Problema / detalle<textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
        <label className="f">Causa inmediata (opcional)<input value={causa} onChange={(e) => setCausa(e.target.value)} /></label>
        {failureExtraFields.map((f) => (
          <label key={f.key} className="f">{f.label}
            {f.type === 'textarea' ? <textarea value={extra[f.key] ?? ''} onChange={(e) => setExtra({ ...extra, [f.key]: e.target.value })} />
              : f.type === 'select' ? <select value={extra[f.key] ?? ''} onChange={(e) => setExtra({ ...extra, [f.key]: e.target.value })}><option value="">—</option>{f.options!.map((o) => <option key={o}>{o}</option>)}</select>
                : <input value={extra[f.key] ?? ''} onChange={(e) => setExtra({ ...extra, [f.key]: e.target.value })} />}
          </label>
        ))}
        <div>
          <div className="row" style={{ marginBottom: 8 }}>
            <button type="button" className="btn sec" onClick={() => cam.current?.click()}><Camera size={16} />Tomar foto</button>
            <button type="button" className="btn sec" onClick={() => gal.current?.click()}><ImageIcon size={16} />Galería</button>
          </div>
          <input ref={cam} hidden type="file" accept="image/*" capture="environment" onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} />
          <input ref={gal} hidden type="file" accept="image/*" multiple onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} />
          <div className="photos">{fotos.map((f, i) => <div key={i} style={{ position: 'relative' }}><img src={f} alt="" /><button className="btn danger sm" style={{ position: 'absolute', top: 2, right: 2, padding: 2, minHeight: 0 }} onClick={() => setFotos(fotos.filter((_, j) => j !== i))}><X size={12} /></button></div>)}</div>
        </div>
        {err && <div className="alert red">{err}</div>}
        {isDemo && <div className="muted">Modo demo: las fotos se guardan en este dispositivo.</div>}
        <button className={`btn ${sev === 'urgente' ? 'danger' : ''}`} disabled={busy} onClick={submit}>{busy ? 'Enviando…' : 'Enviar reporte'}</button>
      </div>
    </div>
  );
}
