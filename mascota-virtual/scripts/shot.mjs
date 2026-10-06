/**
 * Capturas rápidas en tamaño móvil sobre artifact/preview.html (sin servidor).
 * Ejecuta pasos y guarda capturas donde se indique. Imprime los errores de consola.
 *
 *   node scripts/shot.mjs <carpeta-salida> paso1 paso2 ...
 *
 * Pasos:
 *   new:<especie>:<nombre>   crea la primera mascota (dog, cat, rabbit, parrot, turtle, hamster)
 *   adult                    la hace adulta con vitaminas (+ monedas de prueba)
 *   coins                    +1000 monedas y +20 estrellas
 *   ff:<horas>               adelanta el reloj
 *   nav:<pantalla>           home | shop | events | park | family | album
 *   click:<selector>         toca un elemento
 *   fill:<selector>=<texto>  escribe en un campo
 *   drag:<origen>><destino>  arrastra un elemento sobre otro
 *   rub:<selector>:<veces>   frota con el dedo sobre un elemento (zigzag)
 *   wait:<ms>                espera
 *   close                    cierra todas las ventanas abiertas
 *   shot:<nombre>            guarda <carpeta>/<nombre>.png
 *
 * Opción --play (justo después de la carpeta): capturas 1080x1920 en modo claro, listas para Play Store.
 * Las peticiones al servidor real (Google Sheets) se bloquean: las capturas nunca escriben en la hoja.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// playwright-core del proyecto (en Windows usa el Chrome instalado); si no, el del entorno en la nube
const { chromium } = await import('playwright-core').catch(() => import('/opt/node-tools/node_modules/playwright/index.mjs'));
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [outDir, ...resto] = process.argv.slice(2);
const play = resto[0] === '--play';
const steps = play ? resto.slice(1) : resto;
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch(chrome ? { executablePath: chrome } : {});
const page = await (await browser.newContext({ ...(play ? { viewport: { width: 405, height: 720 }, deviceScaleFactor: 8 / 3, colorScheme: 'light' } : { viewport: { width: 390, height: 844 }, colorScheme: 'dark' }), hasTouch: true })).newPage();
await page.route(/script\.google(usercontent)?\.com/, (r) => r.abort());
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => m.type() === 'error' && !/ERR_FAILED/.test(m.text()) && errors.push('CONSOLE ' + m.text()));

const closeAll = async () => {
  for (let i = 0; i < 10 && (await page.$('.modal-backdrop')); i++) {
    await page.click('.modal-buttons .btn >> nth=-1').catch(() => page.click('.modal-backdrop', { position: { x: 5, y: 5 } }));
    await page.waitForTimeout(120);
  }
};
const debug = async (act, times = 1) => {
  await page.click('[data-act="settings"]');
  await page.click('details.debug summary');
  for (let i = 0; i < times; i++) await page.click(`[data-act="${act}"]`);
  await closeAll();
};
const SPECIES = ['dog', 'cat', 'rabbit', 'parrot', 'turtle', 'hamster'];

await page.goto(pathToFileURL(join(root, 'artifact', 'preview.html')).href);
await page.waitForTimeout(500);

for (const step of steps) {
  const [cmd, ...rest] = step.split(':');
  const arg = rest.join(':');
  try {
    switch (cmd) {
      case 'new': {
        const [sp, name] = arg.split(':');
        await page.click(`.species-card:nth-child(${SPECIES.indexOf(sp) + 1})`);
        await page.fill('#name-input', name || 'Toby');
        await page.click('[data-act="create"]');
        await page.waitForTimeout(200);
        await closeAll();
        break;
      }
      case 'coins': await debug('coins'); break;
      case 'adult':
        await debug('coins', 2);
        await page.click('.nav-btn[data-id="shop"]');
        await page.click('.tab[data-id="accelerator"]');
        for (let i = 0; i < 15; i++) await page.click('[data-act="buy"][data-id="acc_growth_vitamin"]');
        await page.click('.nav-btn[data-id="home"]');
        await page.click('[data-act="backpack"]');
        for (let i = 0; i < 15; i++) await page.click('.item-card[data-id="acc_growth_vitamin"]');
        await closeAll();
        break;
      case 'ff': await debug('ff1', Number(arg)); break;
      case 'nav': await page.click(`.nav-btn[data-id="${arg}"]`); break;
      case 'click': await page.click(arg, { timeout: 3000 }); break;
      case 'fill': { const [sel, txt] = arg.split('='); await page.fill(sel, txt ?? ''); break; }
      case 'drag': {
        const [from, to] = arg.split('>');
        const a = await page.locator(from).first().boundingBox();
        const b = await page.locator(to).first().boundingBox();
        await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
        await page.mouse.down();
        for (let i = 1; i <= 10; i++) await page.mouse.move(a.x + a.width / 2 + ((b.x + b.width / 2) - (a.x + a.width / 2)) * i / 10, a.y + a.height / 2 + ((b.y + b.height / 2) - (a.y + a.height / 2)) * i / 10);
        await page.mouse.up();
        break;
      }
      case 'rub': {
        const [sel, times] = arg.split(':');
        const r = await page.locator(sel).first().boundingBox();
        await page.mouse.move(r.x + r.width * 0.3, r.y + r.height * 0.3);
        await page.mouse.down();
        for (let i = 0; i < Number(times || 40); i++) {
          await page.mouse.move(r.x + r.width * (0.25 + 0.5 * Math.random()), r.y + r.height * (0.2 + 0.6 * Math.random()), { steps: 3 });
        }
        await page.mouse.up();
        break;
      }
      case 'wait': await page.waitForTimeout(Number(arg)); break;
      case 'close': await closeAll(); break;
      case 'shot': await page.waitForTimeout(300); await page.screenshot({ path: join(outDir, `${arg}.png`) }); break;
      default: errors.push(`Paso desconocido: ${step}`);
    }
  } catch (e) {
    errors.push(`Fallo en "${step}": ${e.message.split('\n')[0]}`);
  }
}
console.log(errors.length ? errors.join('\n') : 'OK sin errores');
await browser.close();
