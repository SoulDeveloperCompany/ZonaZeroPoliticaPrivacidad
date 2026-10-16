// Resumen de las estadísticas anónimas de uso: `npm run -s metricas`
// Pide ?accion=metricas al Apps Script (URL de src/core/OnlineConfig.ts) e imprime algo corto:
// jugadores activos por día, retención D1/D3/D7 por día de llegada y los eventos más frecuentes.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = readFileSync(join(raiz, 'src/core/OnlineConfig.ts'), 'utf8').match(/DEFAULT_URL: '([^']+)'/)?.[1];
if (!url) throw new Error('No hay URL del servidor en OnlineConfig.ts');

const m = await (await fetch(`${url}?accion=metricas`, { redirect: 'follow' })).json();
if (!m.ok) throw new Error(JSON.stringify(m));
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');

console.log(`Patitas · ${m.hoy} · ${m.jugadores} jugadores con estadísticas\n`);
console.log('Activos por día: ' + Object.entries(m.activosPorDia).map(([d, n]) => `${d.slice(5)}:${n}`).join('  '));
console.log('\nLlegada      nuevos   D1     D3     D7');
for (const [dia, c] of Object.entries(m.cohortes).sort()) {
  console.log(`${dia}   ${String(c.nuevos).padStart(5)}   ${pct(c.d1, c.nuevos).padEnd(6)} ${pct(c.d3, c.nuevos).padEnd(6)} ${pct(c.d7, c.nuevos)}`);
}
const top = (obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} ${v}`).join(' · ');
console.log(`\nEventos: ${top(m.eventos, 12)}`);
console.log(`Detalle: ${top(m.detalle, 15)}`);
console.log('\nOjo: D1/D3/D7 de los días recientes aún no son definitivos (faltan días por pasar).');
