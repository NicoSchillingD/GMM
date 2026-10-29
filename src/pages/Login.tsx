import { useApp } from '../lib/app';
import { isDemo } from '../lib/db';

export default function Login() {
  const { signIn, data } = useApp();
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--surface-dark)', padding: 16 }}>
      <div className="card" style={{ maxWidth: 420, width: '100%' }}>
        <h1>GMM</h1>
        <div style={{ height: 3, width: 56, background: 'var(--naranjo)', margin: '8px 0 12px' }} />
        <p className="muted" style={{ marginTop: 0 }}>Glasstech Maintenance Manager</p>
        {isDemo ? (
          <div className="form">
            <div className="alert">Modo demo: datos locales en este dispositivo. Elige un perfil.</div>
            {data.profiles.map((p) => (
              <button key={p.id} className="btn sec" onClick={() => signIn(p.id)}>{p.nombre} · {p.rol}</button>
            ))}
          </div>
        ) : (
          <button className="btn" style={{ width: '100%' }} onClick={() => signIn()}>Ingresar con Microsoft 365</button>
        )}
      </div>
    </div>
  );
}
