const { chromium } = require('playwright');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const open = async (b, perms) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: perms });
  const p = await ctx.newPage(); await p.goto('http://localhost:4173/'); await p.click('text=Julio Bustos');
  await p.click('.tabbar a:has-text("Fallas")'); await p.click('text=Reportar falla'); return p;
};
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  let p = await open(b, ['camera']);
  await p.click('button:has-text("Tomar foto")'); await p.waitForSelector('.cam');
  console.log('cámara abierta:', await p.textContent('.cam-top span'));
  await p.waitForFunction(() => { const v = document.querySelector('video'); return v && v.videoWidth > 0 && !v.paused; }, null, { timeout: 10000 });
  const dim = await p.$eval('video', (v) => [v.videoWidth, v.videoHeight]); console.log('✔ video en vivo', dim);
  await p.click('.cam-shutter'); await p.waitForSelector('text=Foto 2 de 3'); console.log('✔ 1ª foto, sigue abierta:', await p.textContent('.cam-top span'));
  await p.click('.cam-shutter'); await p.waitForSelector('text=Foto 3 de 3'); await p.click('.cam-shutter');
  await p.waitForSelector('.cam', { state: 'detached' }); console.log('✔ al 3ª foto la cámara se cierra solo; fotos:', await p.locator('.photos img').count());
  console.log('  botones deshabilitados:', await p.locator('button:has-text("Tomar foto")').isDisabled(), await p.locator('button:has-text("Galería")').isDisabled(), '|', await p.textContent('span.muted:has-text("fotos")'));
  await p.click('button[aria-label="Quitar foto"] >> nth=0'); console.log('✔ al quitar una:', await p.locator('.photos img').count(), 'fotos; Tomar foto habilitado:', await p.locator('button:has-text("Tomar foto")').isEnabled());
  // galería con exceso
  await p.click('button[aria-label="Quitar foto"] >> nth=0');
  await p.setInputFiles('input[type=file][multiple]', [1, 2, 3].map((i) => ({ name: `g${i}.png`, mimeType: 'image/png', buffer: PNG })));
  await p.waitForSelector('text=Máximo 3 fotos'); console.log('✔ galería con exceso:', (await p.textContent('.alert')).slice(0, 80), '| fotos:', await p.locator('.photos img').count());
  await p.close();
  // permiso denegado
  p = await open(b, []);
  await b.contexts().at(-1).grantPermissions([]); 
  await p.addInitScript(() => {}); 
  await p.evaluate(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError')); });
  await p.click('button:has-text("Tomar foto")'); await p.waitForSelector('.cam-err');
  console.log('✔ permiso denegado:', (await p.textContent('.cam-err p')).slice(0, 70), '| botón respaldo:', await p.locator('text=Usar la cámara del sistema').count());
  await b.close();
})().catch((e) => { console.error('FALLÓ:', e.message.split('\n')[0]); process.exit(1); });
