import { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, X } from 'lucide-react';
import CameraCapture from './CameraCapture';
import { compressImage } from '../lib/ui';

export const MAX_COMMENT_PHOTOS = 3;

/** Adjuntar hasta 3 fotos (cámara o galería) a un comentario. `value` son data URLs ya comprimidas. */
export default function PhotoAttach({ value, onChange, max = MAX_COMMENT_PHOTOS }: { value: string[]; onChange: (v: string[]) => void; max?: number }) {
  const [cam, setCam] = useState(false); const [msg, setMsg] = useState('');
  const sys = useRef<HTMLInputElement>(null); const gal = useRef<HTMLInputElement>(null);
  const full = value.length >= max;
  const addFiles = async (fl: FileList | null) => {
    if (!fl?.length) return;
    const room = max - value.length; const files = [...fl].slice(0, Math.max(0, room));
    setMsg(fl.length > room ? `Máximo ${max} fotos por comentario: se agregaron ${files.length} de ${fl.length}.` : '');
    if (files.length) onChange([...value, ...(await Promise.all(files.map((f) => compressImage(f))))].slice(0, max));
  };
  return (
    <div>
      <div className="row">
        <button type="button" className="btn ghost sm" disabled={full} onClick={() => { setMsg(''); setCam(true); }}><Camera size={14} />Tomar foto</button>
        <button type="button" className="btn ghost sm" disabled={full} onClick={() => gal.current?.click()}><ImageIcon size={14} />Galería</button>
        <span className="muted">{value.length} de {max} fotos</span>
      </div>
      <input ref={sys} hidden type="file" accept="image/*" capture="environment" onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} />
      <input ref={gal} hidden type="file" accept="image/*" multiple onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} />
      {msg && <div className="alert" style={{ marginTop: 8 }}>{msg}</div>}
      {cam && <CameraCapture count={value.length} max={max} onCapture={(img) => { const n = [...value, img].slice(0, max); onChange(n); setMsg(''); if (n.length >= max) setCam(false); }} onClose={() => setCam(false)} onFallback={() => { setCam(false); sys.current?.click(); }} />}
      {!!value.length && <div className="photos" style={{ marginTop: 8 }}>{value.map((f, i) => <div key={i} style={{ position: 'relative' }}><img src={f} alt={`Foto ${i + 1}`} /><button type="button" aria-label="Quitar foto" className="btn danger sm" style={{ position: 'absolute', top: 2, right: 2, padding: 2, minHeight: 0 }} onClick={() => { onChange(value.filter((_, j) => j !== i)); setMsg(''); }}><X size={12} /></button></div>)}</div>}
    </div>
  );
}
