import { useState } from 'react';
import { useApp } from '../lib/app';
import { isDemo } from '../lib/db';

export default function Login() {
  const { signIn, resetPassword, data } = useApp();
  const [email, setEmail] = useState(''); const [pass, setPass] = useState('');
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg('');
    setMsg((await signIn(email, pass)) ?? ''); setBusy(false);
  };
  const forgot = async () => {
    if (!email) return setMsg('Escribe tu correo para recuperar la contraseña.');
    setMsg((await resetPassword(email)) ?? 'Te enviamos un correo para restablecer tu contraseña.');
  };

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
          <form className="form" onSubmit={submit}>
            <label className="f">Correo corporativo<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="f">Contraseña<input type="password" autoComplete="current-password" required value={pass} onChange={(e) => setPass(e.target.value)} /></label>
            {msg && <div className="alert">{msg}</div>}
            <button className="btn" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
            <button type="button" className="btn ghost sm" onClick={forgot}>Olvidé mi contraseña</button>
          </form>
        )}
      </div>
    </div>
  );
}
