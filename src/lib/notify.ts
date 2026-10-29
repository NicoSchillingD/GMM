/** Notificación local del navegador (el envío Web Push multiusuario va por la Edge Function notify-failure). */
export async function askNotifyPermission() {
  if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
}
export function notifyLocal(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  navigator.serviceWorker?.getRegistration().then((r) => { if (r) void r.showNotification(title, { body, icon: '/icon.svg' }); else new Notification(title, { body }); });
}
