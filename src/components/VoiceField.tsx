import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';

interface Rec { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; abort(): void; onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null }
const SR = (): (new () => Rec) | null => { const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }; return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null; };

interface Props { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; required?: boolean; hint?: string }

/** Campo de texto que se puede escribir o dictar por voz (español de Chile): lo dictado se agrega al texto. */
export default function VoiceField({ label, value, onChange, multiline = true, required, hint }: Props) {
  const supported = SR() !== null;
  const [on, setOn] = useState(false); const [interim, setInterim] = useState(''); const [msg, setMsg] = useState('');
  const rec = useRef<Rec | null>(null); const base = useRef(''); const valueRef = useRef(value);
  valueRef.current = value;
  useEffect(() => () => rec.current?.abort(), []);

  const join = (a: string, b: string) => (a && b ? `${a.replace(/\s+$/, '')} ${b}` : a || b);
  const start = () => {
    const R = SR(); if (!R) return;
    setMsg(''); base.current = valueRef.current;
    const r = new R(); r.lang = 'es-CL'; r.continuous = true; r.interimResults = true;
    r.onresult = (e) => {
      let fin = ''; let tmp = '';
      for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) fin += t; else tmp += t; }
      if (fin) { base.current = join(base.current, fin.trim()); onChange(base.current); }
      setInterim(tmp);
    };
    r.onerror = (e) => setMsg(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'No diste permiso para usar el micrófono. Actívalo en los ajustes del navegador para este sitio.' : e.error === 'no-speech' ? 'No se escuchó nada. Intenta de nuevo.' : e.error === 'network' ? 'El dictado necesita conexión a internet.' : 'No se pudo dictar. Escribe el texto.');
    r.onend = () => { setOn(false); setInterim(''); };
    rec.current = r; setOn(true);
    try { r.start(); } catch { setOn(false); }
  };
  const stop = () => rec.current?.stop();
  const shown = interim ? join(value, interim) : value;

  return (
    <div className="f">
      <span className="row" style={{ justifyContent: 'space-between' }}>
        <span>{label}{required && ' *'}</span>
        {supported && <button type="button" className={`btn sm ${on ? 'danger' : 'sec'}`} onClick={on ? stop : start} aria-pressed={on}>{on ? <><Square size={14} />Detener</> : <><Mic size={14} />Dictar</>}</button>}
      </span>
      {multiline
        ? <textarea value={shown} readOnly={on} onChange={(e) => onChange(e.target.value)} aria-label={label} />
        : <input value={shown} readOnly={on} onChange={(e) => onChange(e.target.value)} aria-label={label} />}
      {on && <span className="muted">● Escuchando… habla con normalidad y toca "Detener" al terminar.</span>}
      {msg && <span className="alert">{msg}</span>}
      {!supported && <span className="muted">Este navegador no dicta por voz en la app; usa el micrófono del teclado de tu teléfono.</span>}
      {hint && !on && <span className="muted">{hint}</span>}
    </div>
  );
}
