const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 800 } });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:4173/'); await p.click('text=Julio Bustos');
  await p.click('.tabbar a:has-text("Fallas")'); await p.click('text=Reportar falla');
  await p.click('button:has-text("Urgente")'); await p.fill('input[placeholder^="Buscar"]', 'AL-MC');
  await p.selectOption('select >> nth=0', { index: 0 });
  await p.fill('textarea >> nth=0', 'Se detuvo el cabezal');
  await p.setInputFiles('input[capture]', { name: 'f.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
  await p.waitForSelector('.photos img'); await p.click('text=Enviar reporte');
  await p.waitForURL(/fallas\//); console.log('detalle:', await p.textContent('h1'));
  await p.goto('http://localhost:4173/'); console.log('alert:', await p.textContent('.alert.red'));
  await p.screenshot({ path: process.argv[2] || 'shot.png' }); console.log('errors:', errs); await b.close();
})();
