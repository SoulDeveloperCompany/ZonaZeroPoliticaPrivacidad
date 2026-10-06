/**
 * Genera una versión del juego en UN solo archivo HTML (JS y CSS incrustados)
 * para publicarla como artefacto de Claude o abrirla sin servidor.
 *   npm run artifact   →  artifact/patitas.html
 */
import { build } from 'vite';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = join(root, 'artifact', '.build');
rmSync(tmp, { recursive: true, force: true });

await build({
  root,
  configFile: false,
  logLevel: 'warn',
  base: './',
  build: {
    outDir: tmp,
    emptyOutDir: true,
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: { input: join(root, 'index.html'), output: { codeSplitting: false } },
  },
});

const assets = join(tmp, 'assets');
const files = readdirSync(assets);
const js = readFileSync(join(assets, files.find((f) => f.endsWith('.js'))), 'utf8');
const css = readFileSync(join(assets, files.find((f) => f.endsWith('.css'))), 'utf8');
if (js.toLowerCase().includes('</script')) throw new Error('El JS contiene </script>');

// Sin <html>/<head>/<body>: el visor de artefactos añade el esqueleto
const page = `<title>Patitas</title>
<style>
${css}
html, body { height: 100%; overflow: hidden; }
.app { height: 100%; }
</style>
<div id="splash">🐾</div>
<div id="app"></div>
<script type="module">
${js}
</script>
`;
mkdirSync(join(root, 'artifact'), { recursive: true });
writeFileSync(join(root, 'artifact', 'patitas.html'), page);
// Versión con esqueleto completo para abrirla en un navegador / capturas
writeFileSync(
  join(root, 'artifact', 'preview.html'),
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>${page}</body></html>`,
);
rmSync(tmp, { recursive: true, force: true });
console.log(`artifact/patitas.html (${Math.round(page.length / 1024)} KB)`);
