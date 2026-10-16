// Revisión rápida antes de compilar o hacer commit: `npm run -s revisar`
// - Tipos (tsc), tests de la lógica (vitest) y prueba del Apps Script con una hoja simulada
// - URL del servidor puesta, herramientas de prueba fuera de la versión de tienda, versión de Android
// - Que la llave de firma no esté en git y que la política de privacidad exista
// Imprime solo los problemas (o «Todo bien»), para que sea corto de leer.
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (f) => readFileSync(join(raiz, f), 'utf8');
const problemas = [];
const correr = (cmd) => {
  try { return { ok: true, out: execSync(cmd, { cwd: raiz, stdio: 'pipe', encoding: 'utf8' }) }; }
  catch (e) { return { ok: false, out: `${e.stdout || ''}${e.stderr || ''}` }; }
};
const resumen = (out, re, n = 12) => out.split(/\r?\n/).filter((l) => re.test(l)).slice(0, n).join('\n');

// 1) Tipos
const tsc = correr('npx tsc --noEmit --pretty false');
if (!tsc.ok) problemas.push(`Tipos (tsc):\n${resumen(tsc.out, /error TS/)}`);

// 2) Tests de la lógica
const test = correr('npx vitest run --reporter=dot');
const linea = (test.out.match(/Tests\s+.*$/m) || ['Tests ?'])[0].trim();
if (!test.ok) problemas.push(`Tests: ${linea}\n${resumen(test.out, /FAIL|AssertionError|Error:/)}`);

// 3) Apps Script con hoja simulada
const srv = correr('node scripts/test-server.mjs');
if (!srv.ok || !/Servidor OK/.test(srv.out)) problemas.push(`Servidor (test:server):\n${resumen(srv.out, /✘|Error|fall/i)}`);

// 4) Configuración para publicar
if (!/DEFAULT_URL: 'https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec'/.test(leer('src/core/OnlineConfig.ts')))
  problemas.push('OnlineConfig.DEFAULT_URL no tiene la URL /exec del servidor');
if (!/\$\{HERRAMIENTAS \? `<details class="debug">/.test(leer('src/ui/App.ts')))
  problemas.push('Las "Herramientas de prueba" de App.ts ya no dependen de HERRAMIENTAS (saldrían en la versión de tienda)');
const version = (leer('android/app/build.gradle').match(/versionName "([\d.]+)"/) || [])[1];
if (!version) problemas.push('No encuentro versionName "x.y.z" en android/app/build.gradle');
if (correr('git ls-files --error-unmatch android/keystore.properties').ok) problemas.push('¡android/keystore.properties está en git! Quítalo (git rm --cached).');
if (!existsSync(join(raiz, 'public-pages/privacidad.html'))) problemas.push('Falta public-pages/privacidad.html (la usa la ficha de Play Store)');

console.log(problemas.length ? `${problemas.length} problema(s):\n\n${problemas.join('\n\n')}` : `Todo bien · ${linea} · versión ${version}`);
process.exit(problemas.length ? 1 : 0);
