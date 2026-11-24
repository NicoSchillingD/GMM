import { useEffect, useRef, useState } from 'react';
import { Circle, Square, X } from 'lucide-react';

export const MAX_VIDEO_SECONDS = 10;

interface Props {
  count: number; max: number;
  onCapture: (blob: Blob, seconds: number) => void;
  onClose: () => void;
  /** Respaldo: abre la cámara del sistema (selector de archivos con captura). */
  onFallback: () => void;
}

const pickMime = () => ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m));

/** Graba un video con la cámara del dispositivo; se detiene solo a los 10 segundos. */
export default function VideoCapture({ count, max, onCapture, onClose, onFallback }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const timer = useRef<number>(0);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return setError('Este navegador no permite grabar video desde la app.');
      const video_ = { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } };
      try {
        let s: MediaStream;
        try { s = await navigator.mediaDevices.getUserMedia({ video: video_, audio: true }); }
        catch (e) { // sin permiso de micrófono: se graba solo imagen
          if ((e as DOMException).name !== 'NotAllowedError' && (e as DOMException).name !== 'NotFoundError') throw e;
          s = await navigator.mediaDevices.getUserMedia({ video: video_, audio: false });
        }
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) { video.current.srcObject = s; await video.current.play().catch(() => {}); }
        setReady(true);
      } catch (e) {
        if (!cancelled) setError((e as DOMException).name === 'NotAllowedError'
          ? 'No diste permiso para usar la cámara. Actívalo en los ajustes del navegador para este sitio.'
          : 'No se encontró una cámara disponible.');
      }
    })();
    return () => { cancelled = true; window.clearInterval(timer.current); if (rec.current?.state === 'recording') { rec.current.onstop = null; rec.current.stop(); } stream.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  const stop = () => { if (rec.current?.state === 'recording') rec.current.stop(); };
  const start = () => {
    if (!stream.current || recording) return;
    chunks.current = [];
    const mimeType = pickMime();
    const r = new MediaRecorder(stream.current, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 1_500_000 });
    r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    r.onstop = () => {
      window.clearInterval(timer.current); setRecording(false);
      const seconds = Math.min(MAX_VIDEO_SECONDS, (Date.now() - started.current) / 1000);
      const blob = new Blob(chunks.current, { type: r.mimeType || mimeType || 'video/webm' });
      if (blob.size) onCapture(blob, seconds);
      onClose();
    };
    rec.current = r; started.current = Date.now(); setSecs(0);
    r.start(500);
    setRecording(true);
    timer.current = window.setInterval(() => {
      const t = (Date.now() - started.current) / 1000;
      setSecs(t);
      if (t >= MAX_VIDEO_SECONDS) stop();
    }, 100);
  };

  return (
    <div className="cam" role="dialog" aria-modal="true" aria-label="Grabar video">
      <div className="cam-top"><span>Video {Math.min(count + 1, max)} de {max} · máx. {MAX_VIDEO_SECONDS} s</span><button type="button" className="btn ghost" style={{ color: '#fff' }} onClick={onClose} aria-label="Cerrar cámara"><X size={20} /></button></div>
      {error ? (
        <div className="cam-err">
          <p>{error}</p>
          <button type="button" className="btn accent" onClick={onFallback}>Usar la cámara del sistema</button>
          <button type="button" className="btn ghost" style={{ color: '#fff' }} onClick={onClose}>Cancelar</button>
        </div>
      ) : (
        <>
          <video ref={video} className="cam-video" playsInline muted autoPlay />
          <div className="cam-bottom">
            <span className="cam-timer" aria-live="polite">{recording ? `● ${secs.toFixed(1)} / ${MAX_VIDEO_SECONDS} s` : `0 / ${MAX_VIDEO_SECONDS} s`}</span>
            {recording
              ? <button type="button" className="cam-shutter rec" onClick={stop} aria-label="Detener grabación"><Square size={24} /></button>
              : <button type="button" className="cam-shutter" disabled={!ready || count >= max} onClick={start} aria-label="Empezar a grabar"><Circle size={26} /></button>}
            <button type="button" className="btn sec" disabled={recording} onClick={onClose}>Cancelar</button>
          </div>
        </>
      )}
    </div>
  );
}
