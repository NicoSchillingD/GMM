import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';

interface Rec { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; abort(): void; onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null }
const SR = (): (new () => Rec) | null => { const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }; return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null; };

interface Props { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; required?: boolean; hint?: string }

/** Campo de texto que se puede escribir o dictar por voz (español de Chile): lo dictado se agrega al texto. */
export default function VoiceField({ label, value, onChange, multiline = true, required, hint }: Props) {
  const supported = SR() !== null;
  const [on, setOn] = useState(false); const [msg, setMsg] = useState('');
  const rec = useRef<Rec | null>(null); const base = useRef(''); const valueRef = useRef(value);
  valueRef.current = value;
  useEffect(() => () => rec.current?.abort(), []);

  const join = (a: string, b: string) => (a && b ? `${a.replace(/\s+$/, '')} ${b}` : a || b);
  /** Pide el permiso del micrófono de forma explícita (abre el aviso del navegador) y explica por qué falla si no se obtiene. */
  const ensureMic = async (): Promise<string | null> => {
    const pp = (document as unknown as { permissionsPolicy?: { allowsFeature(f: string): boolean }; featurePolicy?: { allowsFeature(f: string): boolean } });
    const policy = pp.permissionsPolicy ?? pp.featurePolicy;
    if (policy && !policy.allowsFeature('microphone'))
      return 'Esta versión de la App tiene el micrófono bloqueado. Es una versión antigua guardada en el dispositivo: cierra la App o la pestaña, ábrela de nuevo (o recarga con Ctrl+Shift+R) para actualizarla.';
    if (!navigator.mediaDevices?.getUserMedia) return null; // sin API: se intenta igual con el dictado del navegador
    try { (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach((t) => t.stop()); return null; }
    catch (e) {
      const name = (e as DOMException).name;
      if (name === 'NotFoundError') return 'No se encontró un micrófono en este dispositivo.';
      if (name === 'NotReadableError') return 'El micrófono está en uso por otra aplicación. Ciérrala e intenta de nuevo.';
      let state = '';
      try { state = (await navigator.permissions.query({ name: 'microphone' as PermissionName })).state; } catch { /* no soportado */ }
      return state === 'denied'
        ? 'El micrófono está bloqueado para este sitio. Toca el candado junto a la dirección → Micrófono → Permitir, y recarga la página.'
        : 'No se concedió el permiso del micrófono. Toca "Dictar" de nuevo y elige "Permitir" en el aviso del navegador.';
    }
  };
  const start = async () => {
    const R = SR(); if (!R) return;
    setMsg(''); base.current = valueRef.current;
    const problem = await ensureMic();
    if (problem) return setMsg(problem);
    const r = new R(); r.lang = 'es-CL'; r.continuous = true; r.interimResults = true;
    const start0 = base.current;
    // Cada evento trae la transcripción completa de la sesión: se recalcula todo (sin duplicar) y se guarda en el campo
    // al instante, incluso la parte provisional, para que al detener no se pierda nada.
    r.onresult = (e) => {
      let all = '';
      for (let i = 0; i < e.results.length; i++) all += e.results[i][0].transcript;
      all = all.trim();
      if (all) { base.current = join(start0, all); onChange(base.current); }
    };
    r.onerror = (e) => setMsg(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'No diste permiso para usar el micrófono. Actívalo en los ajustes del navegador para este sitio.' : e.error === 'no-speech' ? 'No se escuchó nada. Intenta de nuevo.' : e.error === 'network' ? 'El dictado necesita conexión a internet.' : 'No se pudo dictar. Escribe el texto.');
    r.onend = () => { setOn(false); };
    rec.current = r; setOn(true);
    try { r.start(); } catch { setOn(false); }
  };
  const stop = () => rec.current?.stop();

  return (
    <div className="f">
      <span className="row" style={{ justifyContent: 'space-between' }}>
        <span>{label}{required && ' *'}</span>
        {supported && <button type="button" className={`btn sm ${on ? 'danger' : 'sec'}`} onClick={on ? stop : () => void start()} aria-pressed={on}>{on ? <><Square size={14} />Detener</> : <><Mic size={14} />Dictar</>}</button>}
      </span>
      {multiline
        ? <textarea value={value} readOnly={on} onChange={(e) => onChange(e.target.value)} aria-label={label} />
        : <input value={value} readOnly={on} onChange={(e) => onChange(e.target.value)} aria-label={label} />}
      {on && <span className="muted">● Escuchando… habla con normalidad y toca "Detener" al terminar.</span>}
      {msg && <span className="alert">{msg}</span>}
      {!supported && <span className="muted">Este navegador no dicta por voz en la app; usa el micrófono del teclado de tu teléfono.</span>}
      {hint && !on && <span className="muted">{hint}</span>}
    </div>
  );
}
