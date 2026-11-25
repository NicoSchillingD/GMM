import { useEffect, useState } from 'react';

const KEY = 'gmm-splash-ts';
const ANTIRREBOTE = 20_000; // ms: una recarga inmediata no repite la animación

/** Con "reducir movimiento" se muestra una versión suave (solo se desvanece), no se omite. */
const reducida = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

/**
 * ¿Mostrar la animación? En cada apertura de la App (al iniciarla de cero o recargar), salvo si se mostró hace menos de 20 s.
 * Se usa localStorage con la hora y no sessionStorage: en iPhone la sesión de la App instalada puede conservarse entre aperturas.
 */
function mostrar() {
  try {
    const last = Number(localStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < ANTIRREBOTE) return false;
    localStorage.setItem(KEY, String(Date.now()));
  } catch { /* sin almacenamiento: se muestra igual */ }
  return true;
}

/** Animación de entrada con el logo GMM: aparecen las letras, entran las barras azul y naranja, un destello recorre el logo. */
export default function Splash() {
  const [on, setOn] = useState(mostrar);
  const [soft] = useState(reducida);
  useEffect(() => {
    if (!on) return;
    const t = window.setTimeout(() => setOn(false), soft ? 1900 : 3300); // animación + desvanecido final
    return () => window.clearTimeout(t);
  }, [on]);
  if (!on) return null;
  return (
    <div className={`splash${soft ? ' soft' : ''}`} role="presentation" onClick={() => setOn(false)} aria-hidden="true">
      <div className="splash-logo">
        <div className="splash-word">
          <span className="sp-l sp-g"><span className="sp-bar-top" /><span className="sp-bar-bot" />G</span>
          <span className="sp-l sp-m1">M</span>
          <span className="sp-l sp-m2">M</span>
          <span className="splash-glint" aria-hidden="true">GMM</span>
        </div>
        <div className="splash-brand">GLASSTECH</div>
      </div>
    </div>
  );
}
