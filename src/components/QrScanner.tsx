import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import jsQR from 'jsqr';

interface Props { onScan: (text: string) => void; onClose: () => void }

/** Lector de QR con la cámara del dispositivo. Llama a onScan con el texto del primer código leído. */
export default function QrScanner({ onScan, onClose }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null; let raf = 0; let stopped = false; let last = 0;
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const tick = (t: number) => {
      if (stopped) return;
      const v = video.current;
      if (v && v.readyState >= 2 && v.videoWidth && t - last > 120) {
        last = t;
        const k = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
        canvas.width = Math.round(v.videoWidth * k); canvas.height = Math.round(v.videoHeight * k);
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
        if (code?.data) { stopped = true; onScan(code.data); return; }
      }
      raf = requestAnimationFrame(tick);
    };
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setError('Este navegador no permite abrir la cámara desde la app.');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (stopped) return stream.getTracks().forEach((x) => x.stop());
        if (video.current) { video.current.srcObject = stream; await video.current.play().catch(() => {}); }
        raf = requestAnimationFrame(tick);
      } catch (e) {
        setError((e as DOMException).name === 'NotAllowedError' ? 'No diste permiso para usar la cámara. Actívalo en los ajustes del navegador para este sitio.' : 'No se encontró una cámara disponible.');
      }
    })();
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((x) => x.stop()); };
  }, [onScan]);

  return (
    <div className="cam" role="dialog" aria-modal="true" aria-label="Escanear código QR">
      <div className="cam-top"><span>Apunta al código QR del equipo</span><button type="button" className="btn ghost" style={{ color: '#fff' }} onClick={onClose} aria-label="Cerrar cámara"><X size={20} /></button></div>
      {error ? (
        <div className="cam-err"><p>{error}</p><button type="button" className="btn ghost" style={{ color: '#fff' }} onClick={onClose}>Volver al listado</button></div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <video ref={video} className="cam-video" style={{ height: '100%' }} playsInline muted autoPlay />
          <div className="qr-frame" aria-hidden />
        </div>
      )}
    </div>
  );
}
