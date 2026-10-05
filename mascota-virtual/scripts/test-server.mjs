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
  Utilities: { getUuid: () => crypto.randomUUID() },
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
const reg = sheets.Regalos || ctx.SpreadsheetApp.getActiveSpreadsheet().insertSheet('Regalos');
if (!reg._rows.length) reg.appendRow(['regalo', 'para', 'monedas', 'estrellas', 'objeto', 'cantidad', 'mensaje', 'activo', 'entregados']);
reg.appendRow(['Bienvenida', 'todos', 500, 5, 'acc_crown', 1, '¡Gracias por probar Patitas!', 'SI', '']);
reg.appendRow(['Solo para B', B, 100, 0, '', '', 'Para ti', 'SI', '']);
reg.appendRow(['Apagado', 'todos', 999, 0, '', '', 'No debe llegar', 'NO', '']);
const ga = post({ accion: 'sincronizar', id: A, apodo: 'x', mascota: pet }).regalos;
check(ga.length === 1 && ga[0].monedas === 500 && ga[0].objeto === 'acc_crown', 'A recibe el regalo para todos');
check(post({ accion: 'sincronizar', id: A, apodo: 'x', mascota: pet }).regalos.length === 0, 'A no lo recibe dos veces');
check(post({ accion: 'sincronizar', id: B, apodo: 'y', mascota: pet }).regalos.length === 2, 'B recibe el de todos y el suyo');
console.log(ok ? '\nServidor OK' : '\nHAY FALLOS');
process.exit(ok ? 0 : 1);
