import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** Logo GMM: mismo estilo que la animación de entrada (Montserrat Bold, barra celeste sobre la G y naranja bajo ella). El tamaño sale de `size` (px). */
export function GmmLogo({ size = 30 }: { size?: number }) {
  return (
    <span className="gmm-logo" style={{ fontSize: size }} role="img" aria-label="GMM">
      <span className="gl-g" aria-hidden="true"><i className="gl-top" /><i className="gl-bot" />G</span>
      <span aria-hidden="true">M</span><span aria-hidden="true">M</span>
    </span>
  );
}

/** Logo oficial de Glasstech (sistema de diseño Glasstech, assets/logo.png). */
export function GlasstechLogo({ height = 40 }: { height?: number }) {
  return <img className="glasstech-logo" src="/glasstech-logo.png" alt="Glasstech" height={height} style={{ height }} />;
}

/** Fila del título de cada sección, con el logo GMM a la derecha a la misma altura del título. `low`: el título va bajo un enlace «← Volver» y el logo se alinea con él. */
export function Top({ children, className = '', low = false }: { children: ReactNode; className?: string; low?: boolean }) {
  return (
    <div className={`top has-brand ${className}`.trim()}>
      {children}
      <Link to="/" className={`top-brand${low ? ' low' : ''}`} aria-label="GMM · ir al Dashboard"><GmmLogo /></Link>
    </div>
  );
}

/** Encabezado del Dashboard: logo Glasstech grande a la izquierda y logo GMM a la derecha. */
export function BrandStrip() {
  return (
    <div className="brandstrip">
      <GlasstechLogo height={68} />
      <Link to="/" aria-label="GMM · Dashboard"><GmmLogo size={34} /></Link>
    </div>
  );
}
