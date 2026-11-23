import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

interface Props {
  count: number; max: number;
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
  /** Respaldo: abre la cámara del sistema (selector de archivos con captura). */
  onFallback: () => void;
}

/** Cámara en vivo del dispositivo (cámara trasera por defecto) para tomar varias fotos seguidas. */
export default function CameraCapture({ count, max, onCapture, onClose, onFallback }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setError('Este navegador no permite abrir la cámara desde la app.');
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
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
    return () => { cancelled = true; stream.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  const snap = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const k = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
    onCapture(c.toDataURL('image/jpeg', 0.75));
  };

  return (
    <div className="cam" role="dialog" aria-modal="true" aria-label="Cámara">
      <div className="cam-top"><span>Foto {Math.min(count + 1, max)} de {max}</span><button type="button" className="btn ghost" style={{ color: '#fff' }} onClick={onClose} aria-label="Cerrar cámara"><X size={20} /></button></div>
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
            <button type="button" className="cam-shutter" disabled={!ready || count >= max} onClick={snap} aria-label="Tomar foto"><Camera size={26} /></button>
            <button type="button" className="btn sec" onClick={onClose}>Listo ({count}/{max})</button>
          </div>
        </>
      )}
    </div>
  );
}
