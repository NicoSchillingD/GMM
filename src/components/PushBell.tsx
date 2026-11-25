import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { disablePush, enablePush, pushState, syncPush, type PushState } from '../lib/push';

const TEXTO: Record<Exclude<PushState, 'unsupported'>, string> = {
  on: 'Notificaciones activadas en este dispositivo. Toca para desactivarlas.',
  off: 'Notificaciones desactivadas. Toca para activarlas.',
  denied: 'Notificaciones bloqueadas en este dispositivo: actívalas en los ajustes del navegador o de la App para este sitio.',
  'ios-install': 'En iPhone las notificaciones funcionan solo con la App instalada: toca Compartir → Agregar a la pantalla de inicio, ábrela desde el ícono y actívalas aquí.',
};

/** Solo el ícono: campana normal = notificaciones activadas; campana cruzada por una raya diagonal = desactivadas. */
export function PushBellView({ state, busy, msg, onClick }: { state: Exclude<PushState, 'unsupported'>; busy?: boolean; msg?: string; onClick: () => void }) {
  const on = state === 'on';
  return (
    <span className="pushbell">
      <button type="button" className={`bell ${on ? 'on' : 'off'}`} disabled={busy} onClick={onClick} title={TEXTO[state]} aria-label={TEXTO[state]} aria-pressed={on}>
        {on ? <Bell size={22} /> : <BellOff size={22} />}
      </button>
      {msg && <span className="bell-msg" role="status">{msg}</span>}
    </span>
  );
}

/** Estado de las notificaciones de este dispositivo; tocar la campana las activa o las desactiva. */
export default function PushBell() {
  const [st, setSt] = useState<PushState | null>(null); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const refresh = () => pushState().then(setSt);
  useEffect(() => { void refresh(); void syncPush(); }, []);
  if (!st || st === 'unsupported') return null;
  const toggle = async () => {
    if (st === 'denied' || st === 'ios-install') return setMsg((m) => (m ? '' : TEXTO[st])); // no se puede activar desde aquí: se explica qué hacer
    setBusy(true); setMsg('');
    if (st === 'on') await disablePush(); else setMsg((await enablePush()) ?? '');
    await refresh(); setBusy(false);
  };
  return <PushBellView state={st} busy={busy} msg={msg} onClick={toggle} />;
}
