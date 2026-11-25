import { Top } from '../components/Brand';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Camera, Image as ImageIcon, QrCode, Video, X } from 'lucide-react';
import CameraCapture from '../components/CameraCapture';
import QrScanner from '../components/QrScanner';
import VoiceField from '../components/VoiceField';
import { resolveScan } from '../lib/qr';
import VideoCapture, { MAX_VIDEO_SECONDS } from '../components/VideoCapture';
import { useApp } from '../lib/app';
import { insert, uid, isDemo, supabase } from '../lib/db';
import { MAX_PHOTOS, MAX_VIDEOS, MAX_VIDEO_BYTES, assetLabel, blobToDataUrl, compressImage, videoDuration, videoExt } from '../lib/ui';
import { failureExtraFields } from '../config/failureFields';
import { notifyEvent } from '../lib/push';
import type { Failure, FailureKind } from '../lib/types';

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
  const [assetId, setAssetId] = useState(() => { const a = sp.get('activo'); return a && data.assets.some((x) => x.id === a) ? a : ''; });
  // Pasos: 1 Equipo (listado o QR) → 2 ¿Falla o hallazgo? → 3 ¿Queda detenido? (solo fallas) → 4 Descripción → 5 Foto o video.
  const [kindChosen, setKindChosen] = useState(false);
  const [step, setStep] = useState<'equipo' | 'tipo' | 'detencion' | 'descripcion' | 'evidencia'>(assetId ? 'tipo' : 'equipo');
  const [scanOpen, setScanOpen] = useState(false); const [scanMsg, setScanMsg] = useState(''); const [cands, setCands] = useState<typeof data.assets>([]);
  // Obligatorio: sin valor por defecto. Sí = Urgente (máquina detenida), No = Informativo.
  const [tipo, setTipo] = useState<FailureKind>('falla');
  const [detenida, setDetenida] = useState<boolean | null>(null);
  const [desc, setDesc] = useState(''); const [causa, setCausa] = useState('');
  const [inicio, setInicio] = useState(nowLocal());
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [fotos, setFotos] = useState<string[]>([]);
  const [camOpen, setCamOpen] = useState(false);
  const [videos, setVideos] = useState<{ blob: Blob; url: string }[]>([]);
  const [vidOpen, setVidOpen] = useState(false);
  const vidIn = useRef<HTMLInputElement>(null);
  const fullVid = videos.length >= MAX_VIDEOS;
  const [photoMsg, setPhotoMsg] = useState('');
  const full = fotos.length >= MAX_PHOTOS;
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const cam = useRef<HTMLInputElement>(null); const gal = useRef<HTMLInputElement>(null);

  const options = data.assets.filter((a) => (!onlyMine || mine.has(a.id)) && (!q || `${a.tag} ${a.tipo} ${a.marca}`.toLowerCase().includes(q.toLowerCase())));
  const addFiles = async (fl: FileList | null) => {
    if (!fl || !fl.length) return;
    const room = MAX_PHOTOS - fotos.length;
    const files = [...fl].slice(0, Math.max(0, room));
    setPhotoMsg(fl.length > room ? `Máximo ${MAX_PHOTOS} fotos por falla: se agregaron ${files.length} de ${fl.length}.` : '');
    if (!files.length) return;
    const imgs = await Promise.all(files.map((f) => compressImage(f)));
    setFotos((p) => [...p, ...imgs].slice(0, MAX_PHOTOS));
  };
  const onCamera = (img: string) => {
    const next = [...fotos, img].slice(0, MAX_PHOTOS);
    setFotos(next); setPhotoMsg('');
    if (next.length >= MAX_PHOTOS) setCamOpen(false);
  };

  const addVideo = async (blob: Blob, known?: number) => {
    if (videos.length >= MAX_VIDEOS) return setPhotoMsg(`Máximo ${MAX_VIDEOS} videos por reporte.`);
    if (blob.size > MAX_VIDEO_BYTES) return setPhotoMsg('El video pesa más de 25 MB. Graba uno más corto.');
    const d = known ?? await videoDuration(blob);
    if (d == null) return setPhotoMsg('No se pudo leer el video. Graba uno nuevo con "Grabar video".');
    if (d > MAX_VIDEO_SECONDS + 0.5) return setPhotoMsg(`El video dura ${Math.round(d)} s; el máximo es ${MAX_VIDEO_SECONDS} s.`);
    setPhotoMsg('');
    setVideos((v) => [...v, { blob, url: URL.createObjectURL(blob) }]);
  };
  const onScan = useCallback((text: string) => {
    setScanOpen(false);
    const r = resolveScan(text, data.assets);
    if (r.asset) { setAssetId(r.asset.id); setCands([]); setScanMsg(`Equipo leído: ${assetLabel(r.asset)}`); }
    else if (r.candidates.length > 1) { setCands(r.candidates); setScanMsg('Ese TAG está repetido en el inventario. Elige el equipo correcto:'); }
    else setScanMsg('Ese código no corresponde a ningún equipo del inventario. Busca el equipo en el listado.');
  }, [data.assets]);
  const steps = (['equipo', 'tipo', ...(tipo === 'falla' ? ['detencion'] : []), 'descripcion', 'evidencia'] as (typeof step)[]);
  const idx = steps.indexOf(step);
  const goNext = () => { setErr(''); setStep(steps[Math.min(steps.length - 1, idx + 1)]); };
  const goBack = () => { setErr(''); setStep(steps[Math.max(0, idx - 1)]); };
  const chosen = data.assets.find((a) => a.id === assetId);
  const submit = async () => {
    if (!assetId) { setStep('equipo'); return setErr('Selecciona el activo o componente.'); }
    if (tipo === 'falla' && detenida === null) { setStep('detencion'); return setErr('Indica si la máquina queda detenida.'); }
    if (fotos.length > MAX_PHOTOS) return setErr(`Máximo ${MAX_PHOTOS} fotos por falla.`);
    if (!desc.trim()) { setStep('descripcion'); return setErr('Describe el problema.'); }
    for (const f of failureExtraFields) if (f.required && !extra[f.key]) return setErr(`Falta: ${f.label}`);
    setBusy(true); setErr('');
    try {
      const urgent = tipo === 'falla' && detenida === true;
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
      let vurls: string[] = [];
      if (supabase) {
        vurls = await Promise.all(videos.map(async (v, i) => {
          const path = `${id}/video-${i}.${videoExt(v.blob.type)}`;
          const { error } = await supabase!.storage.from('failure-photos').upload(path, v.blob, { contentType: v.blob.type || 'video/webm' });
          if (error) throw error;
          return supabase!.storage.from('failure-photos').getPublicUrl(path).data.publicUrl;
        }));
      } else vurls = await Promise.all(videos.map((v) => blobToDataUrl(v.blob)));
      const row: Failure = {
        id, numero: Math.max(0, ...data.failures.map((x) => x.numero)) + 1, tipo, asset_id: assetId, reportado_por: me!.id, severidad: urgent ? 'urgente' : 'informativo', detiene_produccion: urgent,
        inicio_detencion: urgent ? new Date(inicio).toISOString() : null, liberacion: null,
        descripcion: desc.trim(), causa_inmediata: causa.trim(), extra, estado: 'abierto', fotos: urls, videos: vurls, creado: new Date().toISOString(),
        fecha_inicio_solucion: null, nota_status: '', nota_solucion: '', encargado_id: null,
      };
      await insert('failures', row);
      notifyEvent({ event: 'failure_created', failure_id: id });
      await reload();
      nav(`/fallas/${id}`);
    } catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo guardar'); } finally { setBusy(false); }
  };

  const kindBtn = (k: FailureKind, title: string, sub: string, cls: string) => (
    <button type="button" aria-pressed={kindChosen && tipo === k} className={`${cls} ${kindChosen && tipo === k ? 'on' : ''}`} onClick={() => { setTipo(k); setKindChosen(true); setErr(''); setStep(k === 'falla' ? 'detencion' : 'descripcion'); }}><b>{title}</b><span className="muted">{sub}</span></button>
  );
  return (
    <div style={{ maxWidth: 680 }}>
      <Top low><div><Link to="/fallas">← Fallas</Link><h1>{kindChosen ? (tipo === 'falla' ? 'Reportar falla' : 'Reportar hallazgo') : 'Reportar falla o hallazgo'}</h1></div></Top>
      <div className="stepbar" aria-label={`Paso ${idx + 1} de ${steps.length}`}>{steps.map((s, i) => <i key={s} className={i <= idx ? 'on' : ''} />)}</div>
      <div className="muted" style={{ margin: '6px 0 12px' }}>Paso {idx + 1} de {steps.length}</div>
      <div className="card form">
        {step !== 'equipo' && chosen && <div className="row"><span className="badge info">Equipo</span><b>{assetLabel(chosen)}</b><button type="button" className="btn ghost sm" onClick={() => setStep('equipo')}>Cambiar</button></div>}

        {step === 'equipo' && <>
          <h2>1. ¿Qué equipo o componente está comprometido?</h2>
          <button type="button" className="btn accent" onClick={() => { setScanMsg(''); setCands([]); setScanOpen(true); }}><QrCode size={18} />Escanear código QR del equipo</button>
          <div className="muted" style={{ textAlign: 'center' }}>— o elígelo del listado —</div>
          <label className="f">Buscar equipo
            <input placeholder="Buscar por TAG, tipo o marca…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select size={5} value={assetId} onChange={(e) => { setAssetId(e.target.value); setScanMsg(''); setCands([]); }} style={{ height: 150 }}>
              {/* Sin esta opción vacía React preselecciona visualmente la primera, y tocarla no dispara el cambio */}
              <option value="" disabled hidden />
              {options.map((a) => <option key={a.id} value={a.id}>{assetLabel(a)}{a.parent_id ? ' (componente)' : ''}</option>)}
            </select>
          </label>
          {me!.rol === 'supervisor' && <label className="row"><input type="checkbox" style={{ width: 'auto' }} checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />Solo mis activos asignados ({mine.size})</label>}
          {scanMsg && <div className={`alert ${assetId && !cands.length ? '' : 'red'}`}>{scanMsg}</div>}
          {cands.length > 1 && <div className="form">{cands.map((c) => <button key={c.id} type="button" className="btn sec" onClick={() => { setAssetId(c.id); setCands([]); setScanMsg(`Equipo elegido: ${assetLabel(c)}`); }}>{assetLabel(c)} · {data.areas.find((x) => x.id === c.area_id)?.nombre ?? 'sin área'}</button>)}</div>}
          {chosen && <div className="alert">Seleccionado: <b>{assetLabel(chosen)}</b></div>}
          {scanOpen && <QrScanner onScan={onScan} onClose={() => setScanOpen(false)} />}
        </>}

        {step === 'tipo' && <>
          <h2>2. ¿Es una falla o un hallazgo?</h2>
          <div className="sev">
            {kindBtn('falla', 'Falla', 'El equipo dejó de funcionar o funciona mal', 'u')}
            {kindBtn('hallazgo', 'Hallazgo', 'Algo detectado que conviene corregir a tiempo', 'i')}
          </div>
        </>}

        {step === 'detencion' && tipo === 'falla' && <>
          <h2>3. ¿La máquina queda detenida?</h2>
          <div className="sev">
            <button type="button" aria-pressed={detenida === true} className={`u ${detenida === true ? 'on' : ''}`} onClick={() => { setDetenida(true); setErr(''); }}><b>Sí, queda detenida</b><span className="muted">Urgente · pérdida de tiempo productivo</span></button>
            <button type="button" aria-pressed={detenida === false} className={`i ${detenida === false ? 'on' : ''}`} onClick={() => { setDetenida(false); setErr(''); setStep('descripcion'); }}><b>No, sigue operando</b><span className="muted">Informativo · sin pérdida de tiempo productivo</span></button>
          </div>
          {detenida === true && <label className="f">Inicio de la detención<input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} /></label>}
        </>}

        {step === 'descripcion' && <>
          <h2>{tipo === 'falla' ? '4' : '3'}. Describe el problema</h2>
          <VoiceField label="Problema / detalle" required value={desc} onChange={setDesc} hint="Escríbelo o toca “Dictar” y cuéntalo con tu voz." />
          <VoiceField label="Diagnóstico inicial operacional (opcional)" value={causa} onChange={setCausa} multiline hint="Qué observó el operador: causa probable, qué se intentó." />
          {failureExtraFields.map((f) => (
            <label key={f.key} className="f">{f.label}
              {f.type === 'textarea' ? <textarea value={extra[f.key] ?? ''} onChange={(e) => setExtra({ ...extra, [f.key]: e.target.value })} />
                : f.type === 'select' ? <select value={extra[f.key] ?? ''} onChange={(e) => setExtra({ ...extra, [f.key]: e.target.value })}><option value="">—</option>{f.options!.map((o) => <option key={o}>{o}</option>)}</select>
                  : <input value={extra[f.key] ?? ''} onChange={(e) => setExtra({ ...extra, [f.key]: e.target.value })} />}
            </label>
          ))}
        </>}

        {step === 'evidencia' && <>
          <h2>{tipo === 'falla' ? '5' : '4'}. Foto o video (opcional)</h2>
          <div>
            <div className="row" style={{ marginBottom: 8 }}>
              <button type="button" className="btn sec" disabled={full} onClick={() => { setPhotoMsg(''); setCamOpen(true); }}><Camera size={16} />Tomar foto</button>
              <button type="button" className="btn sec" disabled={full} onClick={() => gal.current?.click()}><ImageIcon size={16} />Galería</button>
              <span className="muted">{fotos.length} de {MAX_PHOTOS} fotos</span>
            </div>
            <div className="row" style={{ marginBottom: 8 }}>
              <button type="button" className="btn sec" disabled={fullVid} onClick={() => { setPhotoMsg(''); setVidOpen(true); }}><Video size={16} />Grabar video</button>
              <button type="button" className="btn ghost" disabled={fullVid} onClick={() => vidIn.current?.click()}>Video de galería</button>
              <span className="muted">{videos.length} de {MAX_VIDEOS} videos · máx. {MAX_VIDEO_SECONDS} s</span>
            </div>
            <input ref={vidIn} hidden type="file" accept="video/*" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void addVideo(f); }} />
            <input ref={cam} hidden type="file" accept="image/*" capture="environment" onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} />
            <input ref={gal} hidden type="file" accept="image/*" multiple onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} />
            {photoMsg && <div className="alert" style={{ marginBottom: 8 }}>{photoMsg}</div>}
            {camOpen && <CameraCapture count={fotos.length} max={MAX_PHOTOS} onCapture={onCamera} onClose={() => setCamOpen(false)} onFallback={() => { setCamOpen(false); cam.current?.click(); }} />}
            {vidOpen && <VideoCapture count={videos.length} max={MAX_VIDEOS} onCapture={(b, sec) => void addVideo(b, sec)} onClose={() => setVidOpen(false)} onFallback={() => { setVidOpen(false); vidIn.current?.click(); }} />}
            {!!videos.length && <div className="photos" style={{ marginBottom: 8 }}>{videos.map((v, i) => <div key={v.url} style={{ position: 'relative' }}><video src={v.url} controls playsInline preload="metadata" /><button type="button" aria-label="Quitar video" className="btn danger sm" style={{ position: 'absolute', top: 2, right: 2, padding: 2, minHeight: 0 }} onClick={() => { URL.revokeObjectURL(v.url); setVideos(videos.filter((_, j) => j !== i)); setPhotoMsg(''); }}><X size={12} /></button></div>)}</div>}
            <div className="photos">{fotos.map((f, i) => <div key={i} style={{ position: 'relative' }}><img src={f} alt="" /><button type="button" aria-label="Quitar foto" className="btn danger sm" style={{ position: 'absolute', top: 2, right: 2, padding: 2, minHeight: 0 }} onClick={() => { setFotos(fotos.filter((_, j) => j !== i)); setPhotoMsg(''); }}><X size={12} /></button></div>)}</div>
          </div>
          {isDemo && <div className="muted">Modo demo: las fotos se guardan en este dispositivo.</div>}
        </>}

        {err && <div className="alert red">{err}</div>}
        <div className="row">
          {idx > 0 && <button type="button" className="btn ghost" disabled={busy} onClick={goBack}>← Atrás</button>}
          {step === 'evidencia'
            ? <button className={`btn ${tipo === 'falla' && detenida ? 'danger' : ''}`} disabled={busy} onClick={submit}>{busy ? 'Enviando…' : tipo === 'falla' ? 'Enviar reporte' : 'Enviar hallazgo'}</button>
            : step !== 'tipo' && step !== 'detencion' && <button type="button" className="btn" disabled={step === 'equipo' ? !assetId : !desc.trim()} onClick={goNext}>Siguiente →</button>}
          {step === 'detencion' && detenida === true && <button type="button" className="btn" onClick={goNext}>Siguiente →</button>}
        </div>
      </div>
    </div>
  );
}
