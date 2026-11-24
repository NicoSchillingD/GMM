import { supabase } from './db';

export type PushState = 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on';

const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
const b64 = (s: string) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };

/** Llama a la función send-push (Supabase) y devuelve su respuesta o el motivo del error. */
async function call(body: Record<string, unknown>): Promise<{ data?: Record<string, unknown>; error?: string }> {
  const { data, error } = await supabase!.functions.invoke('send-push', { body });
  if (error) { let m = error.message; if ('context' in error) m = (await (error as { context: Response }).context.json().catch(() => null))?.error ?? m; return { error: m }; }
  return data?.error ? { error: String(data.error) } : { data };
}

export async function pushState(): Promise<PushState> {
  if (!supabase) return 'unsupported';
  if (isIOS() && !standalone()) return 'ios-install'; // en iPhone solo funciona con la App instalada en el inicio
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ? 'on' : 'off';
}

/** Pide el permiso, suscribe este dispositivo y lo registra para el usuario actual. Devuelve un mensaje si falla. */
export async function enablePush(): Promise<string | null> {
  try {
    if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') return 'No se concedió el permiso de notificaciones.';
    const reg = await navigator.serviceWorker.ready;
    const k = await call({ action: 'public-key' });
    if (k.error) return k.error;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(String(k.data!.key)) }));
    const r = await call({ action: 'subscribe', subscription: sub.toJSON(), user_agent: navigator.userAgent });
    return r.error ?? null;
  } catch (e) { return e instanceof Error ? e.message : 'No se pudieron activar las notificaciones.'; }
}

/** Si el dispositivo ya está suscrito, lo asocia al usuario que acaba de ingresar (puede haber cambiado de cuenta). */
export async function syncPush() {
  try { if ((await pushState()) !== 'on') return; const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription(); if (sub) await call({ action: 'subscribe', subscription: sub.toJSON(), user_agent: navigator.userAgent }); } catch { /* sin red */ }
}

/** Al cerrar sesión: el servidor deja de asociar este dispositivo a la cuenta, pero se conserva el permiso para el próximo ingreso. */
export async function detachPush() {
  try { const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription(); if (sub) await call({ action: 'unsubscribe', endpoint: sub.endpoint }); } catch { /* ignorar */ }
}

export async function disablePush() {
  try {
    const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
    if (sub) { await call({ action: 'unsubscribe', endpoint: sub.endpoint }); await sub.unsubscribe(); }
  } catch { /* ignorar */ }
}

/** Avisa a los demás de un evento (la función decide los destinatarios). No bloquea ni falla la acción del usuario. */
export function notifyEvent(body: { event: 'failure_created' | 'status_changed' | 'case_assigned' | 'area_assigned'; failure_id?: string; feedback_id?: string; assignment_id?: string }) {
  if (!supabase) return;
  void call({ action: 'notify', ...body }).catch(() => {});
}
