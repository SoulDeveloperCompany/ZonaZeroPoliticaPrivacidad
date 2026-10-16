// Genera los gráficos del juego con los sprites reales (pantalla de elegir especie): `npm run graficos`
//   play-store/icono-512.png, play-store/grafico-1024x500.png  → ficha de Google Play
//   recursos/icon-*.png, recursos/splash*.png                  → icono y pantalla de carga de la app
// Después `npm run android:iconos` convierte recursos/ en los iconos de Android (como en Mi Zoológico).
// Necesita `npm run artifact` antes (usa artifact/preview.html).
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = await import('playwright-core').catch(() => import('/opt/node-tools/node_modules/playwright/index.mjs'));
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const play = join(root, 'play-store');
const recursos = join(root, 'recursos');
mkdirSync(play, { recursive: true });
mkdirSync(recursos, { recursive: true });

const browser = await chromium.launch(chrome ? { executablePath: chrome } : {});
const page = await browser.newPage();
await page.route(/script\.google/, (r) => r.abort());
await page.goto(pathToFileURL(join(root, 'artifact', 'preview.html')).href);
await page.waitForTimeout(500);
const svgs = await page.$$eval('.species-card svg', (els) => els.map((e) => e.outerHTML));
const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
if (svgs.length < 6) throw new Error('No encontré los sprites: ¿hiciste npm run artifact?');

const base = `<style>*{margin:0;box-sizing:border-box}html,body{background:transparent}body{font-family:${font};}.pet svg{width:100%;height:100%;display:block}</style>`;
const fondo = 'radial-gradient(circle at 50% 38%,#ffd29a 0%,#ffb26b 55%,#f28a3c 100%)';
const perro = (px, dy) => `<div class="pet" style="width:${px}px;height:${px}px;flex:none;transform:translateY(${dy}px)">${svgs[0]}</div>`;
const caja = (w, h, bg, html) => `${base}<div style="width:${w}px;height:${h}px;background:${bg};display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">${html}</div>`;
const sombra = (w, h, b) => `<div style="position:absolute;width:${w}px;height:${h}px;bottom:${b}px;left:50%;transform:translateX(-50%);border-radius:50%;background:rgba(160,70,20,.22)"></div>`;

async function foto(w, h, html, ruta, transparente = false) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(html);
  await page.waitForTimeout(200);
  await page.screenshot({ path: ruta, omitBackground: transparente });
}

// Ficha de Play Store
await foto(512, 512, caja(512, 512, fondo, sombra(420, 100, 20) + perro(640, -62)), join(play, 'icono-512.png'));
const fila = svgs.map((s, i) => `<div class="pet" style="width:200px;height:200px;margin:0 -18px;transform:translateY(${i % 2 ? 22 : 0}px)">${s}</div>`).join('');
await foto(1024, 500, `${base}<div style="width:1024px;height:500px;background:linear-gradient(160deg,#ffe2bd 0%,#ffb26b 60%,#f28a3c 100%);position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center">
  <div style="position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.35) 3px,transparent 4px);background-size:36px 36px"></div>
  <div style="position:relative;font-size:96px;font-weight:900;color:#fff;letter-spacing:1px;text-shadow:0 5px 0 #c96a25,0 10px 24px rgba(120,50,10,.35)">🐾 Patitas</div>
  <div style="position:relative;font-size:34px;font-weight:800;color:#6b3a16;margin:0 0 -30px">Cría, cuida y compite con tu mascota</div>
  <div style="position:relative;display:flex;gap:8px;align-items:flex-end">${fila}</div></div>`, join(play, 'grafico-1024x500.png'));

// Icono de la app (Android recorta el icono adaptable: el perro va dentro del 66 % central)
await foto(1024, 1024, caja(1024, 1024, fondo, sombra(840, 200, 40) + perro(1280, -124)), join(recursos, 'icon-only.png'));
await foto(1024, 1024, caja(1024, 1024, 'transparent', perro(880, -70)), join(recursos, 'icon-foreground.png'), true);
await foto(1024, 1024, caja(1024, 1024, fondo, ''), join(recursos, 'icon-background.png'));

// Pantalla de carga: perro y nombre en el centro
const splash = (bg, color) => caja(2732, 2732, bg, `<div style="display:flex;flex-direction:column;align-items:center">${perro(900, 0)}
  <div style="font-size:150px;font-weight:900;color:${color};margin-top:-40px">Patitas</div></div>`);
await foto(2732, 2732, splash('#fdf3e7', '#e8792b'), join(recursos, 'splash.png'));
await foto(2732, 2732, splash('#1f1a16', '#ffb26b'), join(recursos, 'splash-dark.png'));

await browser.close();
console.log('Listo: play-store/icono-512.png, play-store/grafico-1024x500.png y recursos/ (icono y splash de la app)');
