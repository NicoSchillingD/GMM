import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { disablePush, enablePush, pushState, syncPush, type PushState } from '../lib/push';

/** Estado de las notificaciones de este dispositivo, con botón para activarlas o desactivarlas. */
export default function PushBanner() {
  const [st, setSt] = useState<PushState | null>(null); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const refresh = () => pushState().then(setSt);
  useEffect(() => { void refresh(); void syncPush(); }, []);
  if (!st || st === 'unsupported') return null;
  const toggle = async () => {
    setBusy(true); setMsg('');
    if (st === 'on') await disablePush(); else setMsg((await enablePush()) ?? '');
    await refresh(); setBusy(false);
  };
  if (st === 'ios-install') return <div className="alert" style={{ marginBottom: 12 }}><b>Notificaciones:</b> en iPhone funcionan solo con la App instalada. Toca <b>Compartir → Agregar a la pantalla de inicio</b>, ábrela desde el ícono y actívalas aquí.</div>;
  if (st === 'denied') return <div className="alert" style={{ marginBottom: 12 }}><b>Notificaciones bloqueadas</b> en este dispositivo. Actívalas en los ajustes del navegador o de la App para este sitio y recarga.</div>;
  return (
    <div className={`alert ${st === 'on' ? '' : 'red'}`} style={{ marginBottom: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span>{st === 'on' ? <><Bell size={14} /> Notificaciones activadas en este dispositivo.</> : <><BellOff size={14} /> Activa las notificaciones para enterarte de fallas, hallazgos y asignaciones.</>}</span>
        <button className={`btn sm ${st === 'on' ? 'ghost' : 'accent'}`} disabled={busy} onClick={toggle}>{st === 'on' ? 'Desactivar' : 'Activar notificaciones'}</button>
      </div>
      {msg && <div style={{ marginTop: 6 }}>{msg}</div>}
    </div>
  );
}
