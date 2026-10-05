// ===== Servidor de Patitas (Google Sheets + Apps Script) =====
// Basado en el ranking de Mi Zoológico.
// Pega TODO esto en tu hoja de Google: Extensiones › Apps Script (borra lo que haya),
// guarda y publica: Implementar › Nueva implementación › Aplicación web
//   · Ejecutar como: Yo   · Quién tiene acceso: Cualquier usuario
// Copia la URL que termina en /exec y pégala en el juego (Ajustes › Servidor).
//
// Las pestañas se crean solas la primera vez:
//   Jugadores  · quién juega, su mascota principal y monedas pendientes de cobrar
//   Adopciones · crías publicadas en adopción
//   Parejas    · mascotas adultas ofrecidas para tener crías
//   Puntajes   · mejor puntaje de cada jugador en cada competencia
//   Regalos    · regalos que TÚ escribes a mano (a un jugador o a "todos")

const HOJAS = {
  Jugadores: ['id', 'apodo', 'mascota', 'especie', 'etapa', 'sexo', 'genes', 'accesorios', 'visto', 'pendiente'],
  Adopciones: ['oferta', 'dueno', 'duenoApodo', 'mascotaId', 'nombre', 'especie', 'sexo', 'genes', 'precio', 'fecha', 'estado', 'adoptante'],
  Parejas: ['anuncio', 'dueno', 'duenoApodo', 'mascotaId', 'nombre', 'especie', 'sexo', 'genes', 'tarifa', 'fecha', 'usos', 'activo'],
  Puntajes: ['id', 'apodo', 'competencia', 'puntaje', 'estrellas', 'mascota', 'especie', 'fecha'],
  Regalos: ['regalo', 'para', 'monedas', 'estrellas', 'objeto', 'cantidad', 'mensaje', 'activo', 'entregados'],
};
// Columnas de ids: se guardan como texto para que Sheets no las convierta en números
const COLUMNAS_TEXTO = { Jugadores: ['A'], Adopciones: ['A', 'B', 'D'], Parejas: ['A', 'B', 'D'], Puntajes: ['A'], Regalos: ['B', 'I'] };
const MIN_PARQUE = 30; // minutos que un jugador cuenta como "en el parque" tras su última conexión

// ---------- Utilidades de hojas ----------
function hoja_(nombre) {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let h = libro.getSheetByName(nombre);
  if (!h) {
    h = libro.insertSheet(nombre);
    COLUMNAS_TEXTO[nombre].forEach((c) => h.getRange(c + ':' + c).setNumberFormat('@'));
    h.appendRow(HOJAS[nombre]);
    h.setFrozenRows(1);
  }
  return h;
}
function filas_(nombre) {
  const h = hoja_(nombre);
  const n = h.getLastRow() - 1;
  if (n <= 0) return [];
  const cols = HOJAS[nombre];
  return h.getRange(2, 1, n, cols.length).getValues().map((v, i) => {
    const o = { _fila: i + 2 };
    cols.forEach((c, k) => (o[c] = v[k]));
    ['id', 'dueno', 'oferta', 'anuncio', 'mascotaId', 'para', 'entregados'].forEach((c) => { if (c in o) o[c] = String(o[c]); });
    return o;
  });
}
function escribir_(nombre, obj) {
  const h = hoja_(nombre);
  const fila = HOJAS[nombre].map((c) => (obj[c] === undefined ? '' : obj[c]));
  if (obj._fila) h.getRange(obj._fila, 1, 1, fila.length).setValues([fila]);
  else h.appendRow(fila);
}
function responder_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function nuevoId_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 16);
}

// ---------- Validación ----------
const ESPECIES = ['dog', 'cat', 'rabbit', 'parrot', 'turtle', 'hamster'];
function idValido_(id) { return typeof id === 'string' && /^[a-f0-9]{24}$/.test(id); }
function texto_(v, max) { return String(v || '').replace(/[<>]/g, '').slice(0, max); }
function num_(v, max) { return Math.max(0, Math.min(max, Math.floor(Number(v) || 0))); }
function json_(v) { const s = JSON.stringify(v || {}); return s.length > 600 ? '{}' : s; }
function mascota_(m) {
  m = m || {};
  return {
    nombre: texto_(m.nombre, 16),
    especie: ESPECIES.indexOf(m.especie) >= 0 ? m.especie : 'dog',
    etapa: texto_(m.etapa, 12),
    sexo: m.sexo === 'female' ? 'female' : 'male',
    genes: json_(m.genes),
    accesorios: json_(m.accesorios),
  };
}
/** "SI", "sí", TRUE, "x" o 1 cuentan como activo. */
function activo_(v) {
  return v === true || /^(si|sí|x|1|true|verdadero)$/i.test(String(v).trim());
}

/** Regalos pendientes para un jugador; los marca como entregados. */
function entregarRegalos_(id) {
  const lista = [];
  filas_('Regalos').forEach((f) => {
    const para = f.para.trim().toLowerCase();
    if (!activo_(f.activo) || (para !== 'todos' && para !== id)) return;
    const entregados = f.entregados ? f.entregados.split(',').map((x) => x.trim()) : [];
    if (entregados.indexOf(id) >= 0) return;
    entregados.push(id);
    f.entregados = entregados.join(',');
    escribir_('Regalos', f);
    lista.push({
      regalo: texto_(f.regalo, 40),
      monedas: num_(f.monedas, 100000),
      estrellas: num_(f.estrellas, 1000),
      objeto: texto_(f.objeto, 40),
      cantidad: Math.max(1, num_(f.cantidad, 99)),
      mensaje: texto_(f.mensaje, 200),
    });
  });
  return lista;
}

function sumarPendiente_(idJugador, monedas) {
  const j = filas_('Jugadores').find((f) => f.id === idJugador);
  if (!j) return;
  j.pendiente = num_(j.pendiente, 1e9) + monedas;
  escribir_('Jugadores', j);
}

// ---------- Escritura (el juego hace POST) ----------
function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return responder_({ ok: false, error: 'json' }); }
  if (!idValido_(d.id)) return responder_({ ok: false, error: 'id' });
  const apodo = texto_(d.apodo, 30);
  const candado = LockService.getScriptLock();
  candado.waitLock(10000);
  try {
    switch (d.accion) {
      case 'sincronizar': {
        const m = mascota_(d.mascota);
        let j = filas_('Jugadores').find((f) => f.id === d.id) || { pendiente: 0 };
        const monedas = num_(j.pendiente, 1e9);
        j = Object.assign(j, { id: d.id, apodo, mascota: m.nombre, especie: m.especie, etapa: m.etapa, sexo: m.sexo, genes: m.genes, accesorios: m.accesorios, visto: new Date(), pendiente: 0 });
        escribir_('Jugadores', j);
        // Crías de este jugador que alguien adoptó desde la última vez
        const adoptadas = filas_('Adopciones').filter((f) => f.dueno === d.id && f.estado === 'adoptada');
        adoptadas.forEach((f) => { f.estado = 'entregada'; escribir_('Adopciones', f); });
        return responder_({ ok: true, monedas, adoptadas: adoptadas.map((f) => ({ oferta: f.oferta, mascotaId: f.mascotaId, precio: f.precio })), regalos: entregarRegalos_(d.id) });
      }
      case 'publicarAdopcion': {
        const m = mascota_(d.cria);
        const oferta = nuevoId_();
        escribir_('Adopciones', { oferta, dueno: d.id, duenoApodo: apodo, mascotaId: texto_(d.cria && d.cria.mascotaId, 40), nombre: m.nombre, especie: m.especie, sexo: m.sexo, genes: m.genes, precio: num_(d.precio, 5000), fecha: new Date(), estado: 'disponible', adoptante: '' });
        return responder_({ ok: true, oferta });
      }
      case 'retirarAdopcion': {
        const f = filas_('Adopciones').find((x) => x.oferta === d.oferta && x.dueno === d.id);
        if (!f || f.estado !== 'disponible') return responder_({ ok: false, error: 'no-disponible' });
        f.estado = 'retirada';
        escribir_('Adopciones', f);
        return responder_({ ok: true });
      }
      case 'adoptar': {
        const f = filas_('Adopciones').find((x) => x.oferta === d.oferta);
        if (!f || f.estado !== 'disponible' || f.dueno === d.id) return responder_({ ok: false, error: 'no-disponible' });
        f.estado = 'adoptada';
        f.adoptante = d.id;
        escribir_('Adopciones', f);
        sumarPendiente_(f.dueno, num_(f.precio, 5000));
        return responder_({ ok: true, cria: { nombre: f.nombre, especie: f.especie, sexo: f.sexo, genes: JSON.parse(f.genes || '{}'), duenoApodo: f.duenoApodo } });
      }
      case 'publicarPareja': {
        const m = mascota_(d.mascota);
        const mascotaId = texto_(d.mascota && d.mascota.mascotaId, 40);
        const previa = filas_('Parejas').find((x) => x.dueno === d.id && x.mascotaId === mascotaId);
        const anuncio = previa ? previa.anuncio : nuevoId_();
        escribir_('Parejas', Object.assign(previa || { usos: 0 }, { anuncio, dueno: d.id, duenoApodo: apodo, mascotaId, nombre: m.nombre, especie: m.especie, sexo: m.sexo, genes: m.genes, tarifa: num_(d.tarifa, 2000), fecha: new Date(), activo: true }));
        return responder_({ ok: true, anuncio });
      }
      case 'retirarPareja': {
        const f = filas_('Parejas').find((x) => x.anuncio === d.anuncio && x.dueno === d.id);
        if (f) { f.activo = false; escribir_('Parejas', f); }
        return responder_({ ok: true });
      }
      case 'usarPareja': {
        const f = filas_('Parejas').find((x) => x.anuncio === d.anuncio);
        if (!f || f.activo !== true || f.dueno === d.id) return responder_({ ok: false, error: 'no-disponible' });
        f.usos = num_(f.usos, 1e9) + 1;
        escribir_('Parejas', f);
        sumarPendiente_(f.dueno, num_(f.tarifa, 2000));
        return responder_({ ok: true, nombre: f.nombre, genes: JSON.parse(f.genes || '{}') });
      }
      case 'puntaje': {
        const comp = texto_(d.competencia, 30);
        const puntaje = num_(d.puntaje, 100);
        const previa = filas_('Puntajes').find((x) => x.id === d.id && x.competencia === comp);
        if (previa && previa.puntaje >= puntaje) return responder_({ ok: true });
        escribir_('Puntajes', Object.assign(previa || {}, { id: d.id, apodo, competencia: comp, puntaje, estrellas: num_(d.estrellas, 5), mascota: texto_(d.mascota, 16), especie: ESPECIES.indexOf(d.especie) >= 0 ? d.especie : 'dog', fecha: new Date() }));
        return responder_({ ok: true });
      }
      default:
        return responder_({ ok: false, error: 'accion' });
    }
  } finally {
    candado.releaseLock();
  }
}

// ---------- Lectura (el juego hace GET ?accion=...) ----------
function doGet(e) {
  const p = e.parameter;
  const yo = p.id || '';
  switch (p.accion) {
    case 'adopciones': {
      const disp = filas_('Adopciones').filter((f) => f.estado === 'disponible');
      const fmt = (f) => ({ oferta: f.oferta, duenoApodo: f.duenoApodo, nombre: f.nombre, especie: f.especie, sexo: f.sexo, genes: JSON.parse(f.genes || '{}'), precio: f.precio });
      return responder_({ ok: true, lista: disp.filter((f) => f.dueno !== yo).slice(-30).map(fmt) });
    }
    case 'parejas': {
      const lista = filas_('Parejas').filter((f) => f.activo === true && f.dueno !== yo && (!p.especie || f.especie === p.especie) && (!p.sexo || f.sexo === p.sexo));
      return responder_({ ok: true, lista: lista.slice(-20).map((f) => ({ anuncio: f.anuncio, duenoApodo: f.duenoApodo, nombre: f.nombre, especie: f.especie, sexo: f.sexo, genes: JSON.parse(f.genes || '{}'), tarifa: f.tarifa })) });
    }
    case 'ranking': {
      const filas = filas_('Puntajes').filter((f) => f.competencia === p.competencia).sort((a, b) => b.puntaje - a.puntaje);
      const posicion = yo ? filas.findIndex((f) => f.id === yo) + 1 : 0;
      return responder_({ ok: true, lista: filas.slice(0, 20).map((f) => ({ apodo: f.apodo, mascota: f.mascota, especie: f.especie, puntaje: f.puntaje, estrellas: f.estrellas, yo: f.id === yo })), posicion, total: filas.length });
    }
    case 'parque': {
      const limite = Date.now() - MIN_PARQUE * 60 * 1000;
      const lista = filas_('Jugadores').filter((f) => f.id !== yo && f.visto && new Date(f.visto).getTime() > limite);
      return responder_({ ok: true, lista: lista.slice(-15).map((f) => ({ id: String(f.id).slice(0, 8), apodo: f.apodo, nombre: f.mascota, especie: f.especie, etapa: f.etapa, sexo: f.sexo, genes: JSON.parse(f.genes || '{}'), accesorios: JSON.parse(f.accesorios || '{}') })) });
    }
    default:
      return responder_({ ok: true, servidor: 'Patitas', version: 1 });
  }
}
