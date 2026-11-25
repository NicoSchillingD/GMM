import { Link } from 'react-router-dom';

/** Logo GMM: mismo estilo que la animación de entrada (Montserrat Bold, barra celeste sobre la G y naranja bajo ella). El tamaño sale del font-size. */
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

/** Franja superior derecha: en el Dashboard el logo Glasstech; en el resto de las secciones, el logo GMM. */
export default function BrandBar({ dashboard }: { dashboard: boolean }) {
  return (
    <div className="brandbar">
      <Link to="/" aria-label={dashboard ? 'Glasstech · Dashboard' : 'GMM · ir al Dashboard'}>{dashboard ? <GlasstechLogo /> : <GmmLogo />}</Link>
    </div>
  );
}
