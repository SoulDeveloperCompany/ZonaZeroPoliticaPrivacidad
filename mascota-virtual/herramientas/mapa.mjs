// Índice del código: `npm run -s mapa` (o `npm run -s mapa -- palabra` para filtrar)
// Lista cada archivo de src/ con sus clases, funciones, métodos y constantes exportadas y su número de línea,
// sin leer los archivos enteros. Sirve para saltar directo a la parte que hay que cambiar (gasta muy pocos tokens).
//   npm run -s mapa                 → todo el índice (~8.000 líneas de código en ~2 pantallas)
//   npm run -s mapa -- breed        → solo lo que contenga "breed" (en el nombre del archivo o del símbolo)
//   npm run -s mapa -- --archivos   → solo la lista de archivos con su tamaño y su primer comentario
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const soloArchivos = args.includes('--archivos');
const filtro = (args.find((a) => !a.startsWith('--')) || '').toLowerCase();

const listar = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? listar(p) : /\.ts$/.test(n) ? [p] : [];
});

const patrones = [
  [/^export (?:default )?(?:abstract )?class (\w+)/, (m) => `class ${m[1]}`],
  [/^(?:export )?(?:async )?function (\w+)/, (m) => `${m[1]}()`],
  [/^export const (\w+)\s*[:=]/, (m) => `const ${m[1]}`],
  [/^export (?:type|interface|enum) (\w+)/, (m) => `tipo ${m[1]}`],
  [/^ {2}(?:static |private |protected |public |readonly |async |get |set )*(\w+)\s*(?:<[^>]*>)?\(.*\)(?::\s*[^{=]+)?\s*\{$/, (m) => `  .${m[1]}()`],
];

for (const f of listar(join(raiz, 'src')).sort()) {
  const rel = relative(raiz, f).replace(/\\/g, '/');
  const lineas = readFileSync(f, 'utf8').split(/\r?\n/);
  const doc = (lineas.find((l) => /^\s*\/?\*\*?\s+\S/.test(l)) || '').replace(/^\s*\/?\*+\s*/, '').slice(0, 90);
  if (soloArchivos) {
    if (!filtro || rel.toLowerCase().includes(filtro)) console.log(`${String(lineas.length).padStart(4)}  ${rel}  ${doc}`);
    continue;
  }
  const salida = [];
  lineas.forEach((l, i) => {
    for (const [re, fmt] of patrones) {
      const m = l.match(re);
      if (m && !['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(m[1])) { salida.push(`${String(i + 1).padStart(4)}  ${fmt(m)}`); break; }
    }
  });
  const enNombre = rel.toLowerCase().includes(filtro);
  const lista = !filtro || enNombre ? salida : salida.filter((s) => s.toLowerCase().includes(filtro));
  if (lista.length) console.log(`\n== ${rel} (${lineas.length}) ${doc}\n${lista.join('\n')}`);
}
