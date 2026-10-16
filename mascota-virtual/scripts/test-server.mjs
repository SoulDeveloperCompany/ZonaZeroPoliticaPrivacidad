/**
 * Prueba el script del servidor (server/patitas-apps-script.js) en local,
 * simulando Google Sheets, sin necesidad de subirlo.   node scripts/test-server.mjs
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sheets = {};
function makeSheet(name) {
  const rows = [];
  return {
    appendRow: (r) => rows.push([...r]),
    setFrozenRows: () => {},
    getLastRow: () => rows.length,
    getRange: (row, col, nrows, ncols) => typeof row === 'string' ? { setNumberFormat() {} } : ({
      getValues: () => rows.slice(row - 1, row - 1 + nrows).map((r) => Array.from({ length: ncols }, (_, i) => r[col - 1 + i] ?? '')),
      setValues: (vals) => vals.forEach((v, i) => (rows[row - 1 + i] = [...v])),
    }),
    _rows: rows,
  };
}
const ctx = {
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (n) => sheets[n] || null, insertSheet: (n) => (sheets[n] = makeSheet(n)) }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ setMimeType: () => JSON.parse(t) }) },
  Utilities: { getUuid: () => crypto.randomUUID(), formatDate: (d) => new Date(d).toISOString().slice(0, 10) },
  // Propiedades del script e IA simuladas: nunca se llama a la API real
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => ctx._props[k] ?? null }) },
  UrlFetchApp: { fetch: (url, opts) => { ctx._fetches.push({ url, opts }); return { getResponseCode: () => 200, getContentText: () => JSON.stringify(ctx._iaRespuesta) }; } },
  _props: {}, _fetches: [], _iaRespuesta: null,
  Date, JSON, Math, Number, String, Object,
};
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../server/patitas-apps-script.js', import.meta.url), 'utf8'), ctx);
const post = (d) => ctx.doPost({ postData: { contents: JSON.stringify(d) } });
const get = (p) => ctx.doGet({ parameter: p });

const A = 'a'.repeat(24), B = 'b'.repeat(24);
const pet = { nombre: 'Toby', especie: 'dog', etapa: 'adult', sexo: 'male', genes: { primaryColor: '#123' }, accesorios: {} };
let ok = true;
const check = (cond, msg) => { console.log(cond ? '✔' : '✘', msg); if (!cond) ok = false; };

check(post({ accion: 'sincronizar', id: A, apodo: 'Patita Feliz 111', mascota: pet }).ok, 'sincronizar A');
check(post({ accion: 'sincronizar', id: B, apodo: 'Bigote Veloz 222', mascota: { ...pet, nombre: 'Luna', sexo: 'female' } }).ok, 'sincronizar B');
check(get({ accion: 'parque', id: A }).lista.length === 1, 'A ve a B en el parque');
check(post({ accion: 'sincronizar', id: 'malo' }).ok === false, 'rechaza id inválido');

const of = post({ accion: 'publicarAdopcion', id: A, apodo: 'x', cria: { ...pet, mascotaId: 'p1' }, precio: 90 }).oferta;
check(!!of, 'A publica una cría');
check(get({ accion: 'adopciones', id: A }).lista.length === 0, 'A no ve su propia oferta');
check(get({ accion: 'adopciones', id: B }).lista.length === 1, 'B ve la oferta');
check(post({ accion: 'adoptar', id: B, apodo: 'y', oferta: of }).ok, 'B adopta');
check(post({ accion: 'adoptar', id: B, apodo: 'y', oferta: of }).ok === false, 'no se puede adoptar dos veces');
const s1 = post({ accion: 'sincronizar', id: A, apodo: 'Patita Feliz 111', mascota: pet });
check(s1.monedas === 90 && s1.adoptadas.length === 1, 'A cobra 90 y recibe aviso de adopción');
check(post({ accion: 'sincronizar', id: A, apodo: 'Patita Feliz 111', mascota: pet }).monedas === 0, 'no se cobra dos veces');

const an = post({ accion: 'publicarPareja', id: A, apodo: 'x', mascota: { ...pet, mascotaId: 'p2' }, tarifa: 100 }).anuncio;
check(get({ accion: 'parejas', id: B, especie: 'dog', sexo: 'male' }).lista.length === 1, 'B ve la pareja de A');
check(post({ accion: 'usarPareja', id: B, apodo: 'y', anuncio: an }).ok, 'B usa la pareja');
check(post({ accion: 'sincronizar', id: A, apodo: 'z', mascota: pet }).monedas === 100, 'A cobra la tarifa');

post({ accion: 'puntaje', id: A, apodo: 'x', competencia: 'agility_race', puntaje: 70, estrellas: 4, mascota: 'Toby', especie: 'dog' });
post({ accion: 'puntaje', id: B, apodo: 'y', competencia: 'agility_race', puntaje: 85, estrellas: 5, mascota: 'Luna', especie: 'dog' });
post({ accion: 'puntaje', id: A, apodo: 'x', competencia: 'agility_race', puntaje: 50, estrellas: 2, mascota: 'Toby', especie: 'dog' });
const rk = get({ accion: 'ranking', competencia: 'agility_race', id: A });
check(rk.lista[0].puntaje === 85 && rk.posicion === 2 && rk.lista[1].puntaje === 70, 'ranking guarda el mejor puntaje');
// Regalos escritos a mano en la hoja
ctx.doGet({ parameter: {} });
const reg = sheets.Regalos;
check(reg && reg._rows.length === 3, 'la pestaña Regalos se crea sola con 2 ejemplos desactivados');
reg.appendRow(['Bienvenida', 'todos', 500, 5, 'acc_crown', 1, '¡Gracias por probar Patitas!', 'SI', '']);
reg.appendRow(['Solo para B', B, 100, 0, '', '', 'Para ti', 'SI', '']);
reg.appendRow(['Apagado', 'todos', 999, 0, '', '', 'No debe llegar', 'NO', '']);
const ga = post({ accion: 'sincronizar', id: A, apodo: 'x', mascota: pet }).regalos;
check(ga.length === 1 && ga[0].monedas === 500 && ga[0].objeto === 'acc_crown', 'A recibe el regalo para todos');
check(post({ accion: 'sincronizar', id: A, apodo: 'x', mascota: pet }).regalos.length === 0, 'A no lo recibe dos veces');
check(post({ accion: 'sincronizar', id: B, apodo: 'y', mascota: pet }).regalos.length === 2, 'B recibe el de todos y el suyo');
// ---------- Protección contra trampas ----------
const hex = (c) => c.repeat(24);
const S = hex('c'), C1 = hex('d'), C2 = hex('e'), C3 = hex('f'), C4 = hex('1'), X = hex('9');
for (const id of [S, C1, C2, C3, C4]) post({ accion: 'sincronizar', id, apodo: 'p', mascota: pet });
const caras = [1, 2, 3, 4].map((n) => post({ accion: 'publicarAdopcion', id: S, apodo: 's', cria: { ...pet, mascotaId: 'c' + n }, precio: 5000 }).oferta);
check(sheets.Adopciones._rows.slice(1).filter((r) => r[1] === S).every((r) => r[8] === 220), 'precio de adopción limitado a 220');
check(post({ accion: 'adoptar', id: X, apodo: 'x', oferta: caras[0] }).error === 'sin-sincronizar', 'un ID que nunca sincronizó no puede adoptar');
[C1, C2, C3, C4].forEach((id, i) => post({ accion: 'adoptar', id, apodo: 'c', oferta: caras[i] }));
check(post({ accion: 'sincronizar', id: S, apodo: 's', mascota: pet }).monedas === 600, 'un dueño cobra como mucho 600 al día de otros jugadores');
const otras = [1, 2, 3].map((n) => post({ accion: 'publicarAdopcion', id: S, apodo: 's', cria: { ...pet, mascotaId: 'o' + n }, precio: 50 }).oferta);
check(post({ accion: 'adoptar', id: C1, apodo: 'c', oferta: otras[0] }).ok && post({ accion: 'adoptar', id: C1, apodo: 'c', oferta: otras[1] }).ok, 'se pueden hacer 3 adopciones al día');
check(post({ accion: 'adoptar', id: C1, apodo: 'c', oferta: otras[2] }).error === 'limite', 'la 4.ª adopción del día se rechaza');
post({ accion: 'publicarPareja', id: S, apodo: 's', mascota: { ...pet, mascotaId: 'pp' }, tarifa: 5000 });
check(sheets.Parejas._rows.slice(1).some((r) => r[1] === S && r[8] === 200), 'tarifa de pareja limitada a 200');
post({ accion: 'puntaje', id: C2, apodo: 'c', competencia: 'beauty_contest', puntaje: 40, estrellas: 2, mascota: 'T', especie: 'dog' });
post({ accion: 'puntaje', id: C2, apodo: 'c', competencia: 'beauty_contest', puntaje: 100, estrellas: 5, mascota: 'T', especie: 'dog' });
check(get({ accion: 'ranking', competencia: 'beauty_contest', id: C2 }).lista[0].puntaje === 40, 'solo 1 puntaje por competencia cada 10 min');

// ---------- Métricas ----------
const t = Date.now();
post({ accion: 'sincronizar', id: A, apodo: 'x', mascota: pet, version: '1.2.0', eventos: [{ t, e: 'sesion' }, { t, e: 'etapa', x: 'adult' }, { t: t - 30 * 864e5, e: 'viejo' }] });
post({ accion: 'sincronizar', id: B, apodo: 'y', mascota: pet, version: '1.2.0', eventos: [{ t, e: 'sesion' }] });
const m = get({ accion: 'metricas' });
check(m.ok && m.jugadores === 2 && m.eventos.sesion === 2 && m.detalle['etapa:adult'] === 1 && !m.eventos.viejo, 'métricas: guarda eventos válidos y descarta los antiguos');
check(!JSON.stringify(m).includes(A), 'las métricas no exponen IDs de jugadores');
// ---------- Desafío semanal y regalos en el parque ----------
const sem = Math.floor(Date.now() / (7 * 864e5));
const acciones = ['bathe', 'play', 'walk', 'pet', 'feed'];
const accionSemana = acciones[sem % acciones.length];
const r1 = post({ accion: 'sincronizar', id: A, apodo: 'x', mascota: pet, aportes: { [accionSemana]: 30, otra: 99 } });
check(r1.desafio && r1.desafio.accion === accionSemana && r1.desafio.progreso === 30, 'el desafío de la semana suma lo aportado');
const r2 = post({ accion: 'sincronizar', id: B, apodo: 'y', mascota: pet, aportes: { [accionSemana]: 500 } });
check(r2.desafio.progreso === 80, 'cada sincronización aporta como mucho 50');
check(post({ accion: 'regalo', id: B, apodo: 'Bigote', para: A.slice(0, 8) }).ok, 'B deja una golosina a la mascota de A');
const r3 = post({ accion: 'sincronizar', id: A, apodo: 'x', mascota: pet });
check(r3.buzon.length === 1 && r3.buzon[0].monedas === 15 && r3.buzon[0].de === 'Bigote', 'A recibe la golosina en su buzón');
check(post({ accion: 'sincronizar', id: A, apodo: 'x', mascota: pet }).buzon.length === 0, 'el buzón se vacía al entregarse');
post({ accion: 'regalo', id: B, apodo: 'Bigote', para: A.slice(0, 8) });
post({ accion: 'regalo', id: B, apodo: 'Bigote', para: A.slice(0, 8) });
check(post({ accion: 'regalo', id: B, apodo: 'Bigote', para: A.slice(0, 8) }).error === 'limite', 'como mucho 3 regalos al día');
check(post({ accion: 'regalo', id: X, apodo: 'z', para: A.slice(0, 8) }).ok === false, 'un ID sin sincronizar no puede regalar');
// ---------- Diario con IA (opcional) ----------
const reg1 = { acciones: { feed: 2, bathe: 1 }, comidas: ['filete'], juegos: ['Burbujas'], novedades: ['aprendí a decir «pelota»'] };
check(post({ accion: 'diario', id: A, nombre: 'Toby', especie: 'dog', registro: reg1 }).ia === false && ctx._fetches.length === 0, 'sin clave no llama a la IA (diario local)');
ctx._props.ANTHROPIC_API_KEY = 'clave-de-prueba';
ctx._iaRespuesta = { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Hoy comí filete y me bañaron. ¡Qué día! 🐾' }] };
const dia1 = post({ accion: 'diario', id: A, nombre: 'Toby', especie: 'dog', rasgos: ['gloton', '<script>'], registro: reg1 });
check(dia1.ia === true && dia1.texto.startsWith('Hoy comí filete'), 'con clave devuelve la página escrita por la IA');
const envio = JSON.parse(ctx._fetches[0].opts.payload);
check(envio.model === 'claude-opus-5-5' && envio.fallbacks === 'default' && ctx._fetches[0].opts.headers['anthropic-beta'] === 'server-side-fallback-2026-07-01', 'usa el modelo por defecto con fallbacks');
check(!JSON.stringify(envio).includes('<script>') && JSON.parse(envio.messages[0].content.slice(envio.messages[0].content.indexOf('{'))).rasgos.length === 1, 'solo envía datos del juego validados');
ctx._iaRespuesta = { stop_reason: 'refusal', content: [] };
check(post({ accion: 'diario', id: A, nombre: 'Toby', registro: reg1 }).ia === false, 'si la IA se niega, se usa el diario local');
ctx._iaRespuesta = { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Otra página' }] };
post({ accion: 'diario', id: A, nombre: 'Toby', registro: reg1 });
const antes = ctx._fetches.length;
check(post({ accion: 'diario', id: A, nombre: 'Toby', registro: reg1 }).ia === false && ctx._fetches.length === antes, 'como mucho 3 páginas con IA al día por jugador');
check(post({ accion: 'diario', id: X, nombre: 'X', registro: reg1 }).ia === false, 'un jugador sin sincronizar no gasta IA');
check(post({ accion: 'reportar', id: A, dia: '2026-10-16', texto: 'Hoy comí filete', motivo: 'ofensivo' }).ok && sheets.Reportes._rows.length === 2, 'las denuncias se guardan en la pestaña Reportes');
check(get({}).version === 4, 'el servidor dice version 4');

console.log(ok ? '\nServidor OK' : '\nHAY FALLOS');
process.exit(ok ? 0 : 1);
