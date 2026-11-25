import { useEffect, useState } from 'react';

const KEY = 'gmm-splash-visto';
const DURACION = 3300; // ms: animación (≈3 s) + desvanecido final

/** ¿Corresponde mostrar la animación? Una vez por apertura de la App (no en cada recarga de la pestaña) y no con "reducir movimiento". */
function mostrar() {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    if (sessionStorage.getItem(KEY)) return false;
    sessionStorage.setItem(KEY, '1');
  } catch { /* sin almacenamiento: se muestra igual */ }
  return true;
}

/** Animación de entrada con el logo GMM: aparecen las letras, entran las barras azul y naranja, un destello recorre el logo. */
export default function Splash() {
  const [on, setOn] = useState(mostrar);
  useEffect(() => {
    if (!on) return;
    const t = window.setTimeout(() => setOn(false), DURACION);
    return () => window.clearTimeout(t);
  }, [on]);
  if (!on) return null;
  return (
    <div className="splash" role="presentation" onClick={() => setOn(false)} aria-hidden="true">
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
