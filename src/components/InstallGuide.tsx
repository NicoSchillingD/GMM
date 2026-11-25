import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

const KEY = 'gmm-instalar-oculto';
export const SPLASH_FIN = 'gmm-splash-fin';
export const ABRIR_INSTALAR = 'gmm-abrir-instalar';

const instalada = () => {
  try { return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true; } catch { return false; }
};
const oculta = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };

interface InstallEvent extends Event { prompt(): Promise<void> }

/** Ventana con los pasos para instalar la App en el inicio (Android y luego iPhone). Se muestra al abrir, salvo que ya esté instalada o se haya marcado "No volver a mostrar". */
export default function InstallGuide() {
  const [open, setOpen] = useState(false);
  const [never, setNever] = useState(false);
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Con la animación de entrada en marcha, la ventana espera a que termine.
    const abrir = () => { if (!instalada() && !oculta()) setOpen(true); };
    const splash = document.querySelector('.splash');
    if (splash) window.addEventListener(SPLASH_FIN, abrir, { once: true }); else abrir();
    const manual = () => { setNever(false); setOpen(true); };            // abierta a pedido (enlace "Cómo instalar la App")
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallEvent); }; // Chrome en Android: instalación con un toque
    window.addEventListener(ABRIR_INSTALAR, manual); window.addEventListener('beforeinstallprompt', onPrompt);
    return () => { window.removeEventListener(SPLASH_FIN, abrir); window.removeEventListener(ABRIR_INSTALAR, manual); window.removeEventListener('beforeinstallprompt', onPrompt); };
  }, []);

  useEffect(() => {
    if (!open) return;
    close.current?.focus({ preventScroll: true });
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc);
  });

  const cerrar = () => {
    try { if (never) localStorage.setItem(KEY, '1'); } catch { /* ignorar */ }
    setOpen(false);
  };
  const instalar = async () => { if (!prompt) return; await prompt.prompt(); setPrompt(null); setOpen(false); };

  if (!open) return null;
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="inst-t" onClick={cerrar}>
      <div className="card install" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
          <div><h2 id="inst-t">Instala GMM en tu pantalla de inicio</h2><p className="muted" style={{ margin: '4px 0 0' }}>Se abre como una app, sin barra del navegador, y recibe notificaciones.</p></div>
          <button type="button" className="btn ghost sm" style={{ flexShrink: 0 }} onClick={cerrar} aria-label="Cerrar ventana"><X size={18} /></button>
        </div>

        <section>
          <h3>Android <span className="muted">· Chrome</span></h3>
          <ol>
            <li>Abre esta página en <b>Chrome</b>.</li>
            <li>Toca el menú <b>⋮</b> (arriba a la derecha).</li>
            <li>Elige <b>Instalar app</b> o <b>Agregar a la pantalla principal</b>.</li>
            <li>Confirma con <b>Instalar</b>: el ícono <b>GMM</b> aparece en tu inicio.</li>
          </ol>
          {prompt && <button type="button" className="btn accent sm" onClick={instalar}>Instalar ahora</button>}
        </section>

        <section>
          <h3>iPhone <span className="muted">· Safari</span></h3>
          <ol>
            <li>Abre esta página en <b>Safari</b> (no desde otra app ni otro navegador).</li>
            <li>Toca <b>Compartir</b>, el cuadro con una flecha hacia arriba, en la barra inferior.</li>
            <li>Desliza y elige <b>Agregar a la pantalla de inicio</b>.</li>
            <li>Toca <b>Agregar</b> y, desde ahora, abre GMM desde su ícono.</li>
          </ol>
        </section>

        <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
          <label className="row" style={{ gap: 8, cursor: 'pointer' }}><input type="checkbox" style={{ width: 'auto' }} checked={never} onChange={(e) => setNever(e.target.checked)} />No volver a mostrar</label>
          <button ref={close} type="button" className="btn" onClick={cerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
