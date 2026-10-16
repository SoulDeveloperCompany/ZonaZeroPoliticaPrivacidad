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
//   Eventos    · estadísticas anónimas de uso (sesiones, etapas, minijuegos...). Resumen: ?accion=metricas
//   Comunidad  · progreso del desafío semanal entre todos (ver DESAFIOS)
//   Reportes   · páginas del diario escritas con IA que algún jugador ha denunciado (revísalas)
//
// Diario con IA (OPCIONAL, cuesta dinero por uso): la mascota escribe su diario con Claude.
//   Para activarlo: Apps Script › Configuración del proyecto › Propiedades del script ›
//   añade ANTHROPIC_API_KEY con tu clave (https://console.anthropic.com). Sin clave, el juego
//   escribe el diario él solo (gratis). Opcional: MODELO_IA (por defecto claude-haiku-5-5, ≈0,0001 $ por página;
//   claude-opus-5-5 escribe mejor pero cuesta unas 40 veces más). Tope: DIARIOS_DIA páginas por jugador y día.
//
// Protección contra trampas (el juego decide las monedas en el móvil, así que el servidor pone topes):
//   precio de adopción ≤ PRECIO_MAX · tarifa de pareja entre TARIFA_MIN y TARIFA_MAX
//   cada dueño cobra como mucho INGRESO_MAX_DIA al día de otros jugadores
//   cada jugador adopta ≤ ADOPCIONES_DIA y usa ≤ PAREJAS_DIA parejas al día; 1 puntaje por competencia cada 10 min

const HOJAS = {
  Jugadores: ['id', 'apodo', 'mascota', 'especie', 'etapa', 'sexo', 'genes', 'accesorios', 'visto', 'pendiente', 'limites', 'creado', 'buzon'],
  Adopciones: ['oferta', 'dueno', 'duenoApodo', 'mascotaId', 'nombre', 'especie', 'sexo', 'genes', 'precio', 'fecha', 'estado', 'adoptante'],
  Parejas: ['anuncio', 'dueno', 'duenoApodo', 'mascotaId', 'nombre', 'especie', 'sexo', 'genes', 'tarifa', 'fecha', 'usos', 'activo'],
  Puntajes: ['id', 'apodo', 'competencia', 'puntaje', 'estrellas', 'mascota', 'especie', 'fecha'],
  Regalos: ['regalo', 'para', 'monedas', 'estrellas', 'objeto', 'cantidad', 'mensaje', 'activo', 'entregados'],
  Eventos: ['fecha', 'dia', 'id', 'version', 'evento', 'dato'],
  Comunidad: ['semana', 'accion', 'total'],
  Reportes: ['fecha', 'id', 'dia', 'texto', 'motivo'],
};
// Columnas de ids: se guardan como texto para que Sheets no las convierta en números
const COLUMNAS_TEXTO = { Jugadores: ['A'], Adopciones: ['A', 'B', 'D'], Parejas: ['A', 'B', 'D'], Puntajes: ['A'], Regalos: ['B', 'I'], Eventos: ['B', 'C', 'D'], Comunidad: ['A', 'B'], Reportes: ['B', 'C'] };
const PRECIO_MAX = 220;      // máximo legítimo del juego ≈ 197 (bebé perfecto y muy bello)
const TARIFA_MIN = 50, TARIFA_MAX = 200;
const INGRESO_MAX_DIA = 600; // monedas al día que un dueño puede cobrar de otros jugadores
const ADOPCIONES_DIA = 3, PAREJAS_DIA = 5;
const PUNTAJE_CADA_MS = 10 * 60 * 1000;
const EVENTOS_MAX = 40;      // eventos por sincronización
const REGALOS_DIA = 3, REGALO_MONEDAS = 15, BUZON_MAX = 10;
const APORTE_MAX = 50;       // acciones que cuenta cada sincronización para el desafío
/** Desafíos semanales entre todos: rotan cada semana. Ajusta los objetivos al número de jugadores. */
const DESAFIOS = [
  { accion: 'bathe', titulo: 'Entre todos, {n} baños', objetivo: 200, monedas: 100, estrellas: 1 },
  { accion: 'play', titulo: 'Entre todos, {n} ratos de juego', objetivo: 300, monedas: 100, estrellas: 1 },
  { accion: 'walk', titulo: 'Entre todos, {n} paseos', objetivo: 150, monedas: 120, estrellas: 1 },
  { accion: 'pet', titulo: 'Entre todos, {n} caricias', objetivo: 500, monedas: 100, estrellas: 1 },
  { accion: 'feed', titulo: 'Entre todos, {n} comidas', objetivo: 400, monedas: 100, estrellas: 1 },
];
const MIN_PARQUE = 30; // minutos que un jugador cuenta como "en el parque" tras su última conexión
const DIARIOS_DIA = 3, REPORTES_DIA = 10;
const RASGOS = ['gloton', 'dormilon', 'jugueton', 'timido', 'curioso', 'carinoso', 'presumido'];

// ---------- Utilidades de hojas ----------
function hoja_(nombre) {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let h = libro.getSheetByName(nombre);
  if (!h) {
    h = libro.insertSheet(nombre);
    COLUMNAS_TEXTO[nombre].forEach((c) => h.getRange(c + ':' + c).setNumberFormat('@'));
    h.appendRow(HOJAS[nombre]);
    h.setFrozenRows(1);
    if (nombre === 'Regalos') {
      // Ejemplos desactivados (activo = NO) para que se vea cómo rellenarla
      h.appendRow(['Bienvenida', 'todos', 300, 3, 'acc_bow', 1, '¡Gracias por probar Patitas! Aquí tienes un lazo de regalo.', 'NO', '']);
      h.appendRow(['Regalo de prueba', 'PEGA-AQUI-EL-ID', 1000, 20, 'food_cake', 5, 'Para probar el juego sin límites.', 'NO', '']);
    }
  }
  return h;
}

/** Crea todas las pestañas si faltan y completa cabeceras nuevas (se llama al conectar). También puedes ejecutarla a mano. */
function prepararHojas() {
  Object.keys(HOJAS).forEach((nombre) => {
    const h = hoja_(nombre);
    const cols = HOJAS[nombre];
    if (h.getLastColumn && h.getLastColumn() < cols.length) h.getRange(1, 1, 1, cols.length).setValues([cols]);
  });
}
function hoy_() { return Utilities.formatDate(new Date(), 'GMT', 'yyyy-MM-dd'); }
/** Contadores diarios del jugador (se guardan en la columna "limites" de Jugadores). */
function limites_(j) {
  let l = {};
  try { l = JSON.parse(j.limites || '{}'); } catch (e) { l = {}; }
  if (l.dia !== hoy_()) l = { dia: hoy_(), ingresos: 0, adopciones: 0, parejas: 0, puntajes: l.puntajes || {} };
  if (!l.puntajes) l.puntajes = {};
  return l;
}
function jugador_(id) { return filas_('Jugadores').find((f) => f.id === id); }
/** Semana actual (número de semanas desde 1970) y su desafío. */
function semana_() { return Math.floor(Date.now() / (7 * 864e5)); }
function desafio_() {
  const n = semana_();
  const def = DESAFIOS[n % DESAFIOS.length];
  const fila = filas_('Comunidad').find((f) => String(f.semana) === String(n) && f.accion === def.accion);
  return { semana: String(n), accion: def.accion, titulo: def.titulo.replace('{n}', def.objetivo), objetivo: def.objetivo,
    progreso: fila ? num_(fila.total, 1e9) : 0, premio: { monedas: def.monedas, estrellas: def.estrellas } };
}
/** Suma lo que aportó un jugador al desafío de esta semana. */
function aportar_(aportes) {
  if (!aportes || typeof aportes !== 'object') return;
  const n = semana_();
  const def = DESAFIOS[n % DESAFIOS.length];
  const cant = num_(aportes[def.accion], APORTE_MAX);
  if (!cant) return;
  const fila = filas_('Comunidad').find((f) => String(f.semana) === String(n) && f.accion === def.accion) || { semana: String(n), accion: def.accion, total: 0 };
  fila.total = num_(fila.total, 1e9) + cant;
  escribir_('Comunidad', fila);
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

/** Suma monedas que otro jugador le pagó, con el tope diario de ingresos. */
function sumarPendiente_(idJugador, monedas) {
  const j = jugador_(idJugador);
  if (!j) return;
  const l = limites_(j);
  const cobra = Math.max(0, Math.min(monedas, INGRESO_MAX_DIA - l.ingresos));
  l.ingresos += cobra;
  j.limites = JSON.stringify(l);
  j.pendiente = num_(j.pendiente, 1e9) + cobra;
  escribir_('Jugadores', j);
}

/** Guarda los eventos anónimos de uso que manda el juego (como mucho EVENTOS_MAX por vez). */
function guardarEventos_(id, version, eventos) {
  if (!Array.isArray(eventos) || !eventos.length) return;
  const ahora = Date.now();
  const filas = eventos.slice(0, EVENTOS_MAX)
    .filter((e) => e && typeof e.e === 'string' && Number(e.t) > ahora - 15 * 864e5 && Number(e.t) < ahora + 36e5)
    .map((e) => { const f = new Date(Number(e.t)); return [f, Utilities.formatDate(f, 'GMT', 'yyyy-MM-dd'), id, texto_(version, 12), texto_(e.e, 24), texto_(e.x, 40)]; });
  if (!filas.length) return;
  const h = hoja_('Eventos');
  h.getRange(h.getLastRow() + 1, 1, filas.length, HOJAS.Eventos.length).setValues(filas);
}

// ---------- Escritura (el juego hace POST) ----------
function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return responder_({ ok: false, error: 'json' }); }
  if (!idValido_(d.id)) return responder_({ ok: false, error: 'id' });
  if (d.accion === 'diario') return responder_(diario_(d));
  const apodo = texto_(d.apodo, 30);
  const candado = LockService.getScriptLock();
  candado.waitLock(10000);
  try {
    switch (d.accion) {
      case 'sincronizar': {
        prepararHojas();
        const m = mascota_(d.mascota);
        let j = jugador_(d.id) || { pendiente: 0, creado: new Date() };
        const monedas = num_(j.pendiente, 1e9);
        let buzon = [];
        try { buzon = JSON.parse(j.buzon || '[]'); } catch (e) { buzon = []; }
        j = Object.assign(j, { id: d.id, apodo, mascota: m.nombre, especie: m.especie, etapa: m.etapa, sexo: m.sexo, genes: m.genes, accesorios: m.accesorios, visto: new Date(), pendiente: 0, buzon: '[]' });
        escribir_('Jugadores', j);
        guardarEventos_(d.id, d.version, d.eventos);
        aportar_(d.aportes);
        // Crías de este jugador que alguien adoptó desde la última vez
        const adoptadas = filas_('Adopciones').filter((f) => f.dueno === d.id && f.estado === 'adoptada');
        adoptadas.forEach((f) => { f.estado = 'entregada'; escribir_('Adopciones', f); });
        return responder_({ ok: true, monedas, adoptadas: adoptadas.map((f) => ({ oferta: f.oferta, mascotaId: f.mascotaId, precio: f.precio })), regalos: entregarRegalos_(d.id), buzon, desafio: desafio_() });
      }
      case 'publicarAdopcion': {
        const m = mascota_(d.cria);
        const oferta = nuevoId_();
        escribir_('Adopciones', { oferta, dueno: d.id, duenoApodo: apodo, mascotaId: texto_(d.cria && d.cria.mascotaId, 40), nombre: m.nombre, especie: m.especie, sexo: m.sexo, genes: m.genes, precio: Math.min(num_(d.precio, 5000), PRECIO_MAX), fecha: new Date(), estado: 'disponible', adoptante: '' });
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
        const yo = jugador_(d.id);
        if (!yo) return responder_({ ok: false, error: 'sin-sincronizar' });
        const l = limites_(yo);
        if (l.adopciones >= ADOPCIONES_DIA) return responder_({ ok: false, error: 'limite' });
        l.adopciones++;
        yo.limites = JSON.stringify(l);
        escribir_('Jugadores', yo);
        f.estado = 'adoptada';
        f.adoptante = d.id;
        escribir_('Adopciones', f);
        sumarPendiente_(f.dueno, Math.min(num_(f.precio, 5000), PRECIO_MAX));
        return responder_({ ok: true, cria: { nombre: f.nombre, especie: f.especie, sexo: f.sexo, genes: JSON.parse(f.genes || '{}'), duenoApodo: f.duenoApodo } });
      }
      case 'publicarPareja': {
        const m = mascota_(d.mascota);
        const mascotaId = texto_(d.mascota && d.mascota.mascotaId, 40);
        const previa = filas_('Parejas').find((x) => x.dueno === d.id && x.mascotaId === mascotaId);
        const anuncio = previa ? previa.anuncio : nuevoId_();
        escribir_('Parejas', Object.assign(previa || { usos: 0 }, { anuncio, dueno: d.id, duenoApodo: apodo, mascotaId, nombre: m.nombre, especie: m.especie, sexo: m.sexo, genes: m.genes, tarifa: Math.max(TARIFA_MIN, Math.min(num_(d.tarifa, 2000), TARIFA_MAX)), fecha: new Date(), activo: true }));
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
        const yo = jugador_(d.id);
        if (!yo) return responder_({ ok: false, error: 'sin-sincronizar' });
        const l = limites_(yo);
        if (l.parejas >= PAREJAS_DIA) return responder_({ ok: false, error: 'limite' });
        l.parejas++;
        yo.limites = JSON.stringify(l);
        escribir_('Jugadores', yo);
        f.usos = num_(f.usos, 1e9) + 1;
        escribir_('Parejas', f);
        sumarPendiente_(f.dueno, Math.max(TARIFA_MIN, Math.min(num_(f.tarifa, 2000), TARIFA_MAX)));
        return responder_({ ok: true, nombre: f.nombre, genes: JSON.parse(f.genes || '{}') });
      }
      case 'puntaje': {
        const comp = texto_(d.competencia, 30);
        const puntaje = num_(d.puntaje, 100);
        const yo = jugador_(d.id);
        if (!yo) return responder_({ ok: false, error: 'sin-sincronizar' });
        const l = limites_(yo);
        if (Date.now() - (l.puntajes[comp] || 0) < PUNTAJE_CADA_MS) return responder_({ ok: true });
        l.puntajes[comp] = Date.now();
        yo.limites = JSON.stringify(l);
        escribir_('Jugadores', yo);
        const previa = filas_('Puntajes').find((x) => x.id === d.id && x.competencia === comp);
        if (previa && previa.puntaje >= puntaje) return responder_({ ok: true });
        escribir_('Puntajes', Object.assign(previa || {}, { id: d.id, apodo, competencia: comp, puntaje, estrellas: num_(d.estrellas, 5), mascota: texto_(d.mascota, 16), especie: ESPECIES.indexOf(d.especie) >= 0 ? d.especie : 'dog', fecha: new Date() }));
        return responder_({ ok: true });
      }
      case 'regalo': {
        // Golosina para la mascota de otro jugador del parque ("para" = id corto que se ve en el parque)
        const para = texto_(d.para, 24);
        const yo = jugador_(d.id);
        if (!yo || para.length < 8) return responder_({ ok: false, error: 'sin-sincronizar' });
        const l = limites_(yo);
        if ((l.regalos || 0) >= REGALOS_DIA) return responder_({ ok: false, error: 'limite' });
        const dest = filas_('Jugadores').find((f) => f.id !== d.id && f.id.indexOf(para) === 0);
        if (!dest) return responder_({ ok: false, error: 'no-disponible' });
        l.regalos = (l.regalos || 0) + 1;
        yo.limites = JSON.stringify(l);
        escribir_('Jugadores', yo);
        let buzon = [];
        try { buzon = JSON.parse(dest.buzon || '[]'); } catch (e) { buzon = []; }
        buzon.push({ de: apodo, monedas: REGALO_MONEDAS });
        dest.buzon = JSON.stringify(buzon.slice(-BUZON_MAX));
        escribir_('Jugadores', dest);
        return responder_({ ok: true });
      }
      case 'reportar': {
        // Denuncia de una página del diario escrita con IA (exigencia de Google Play para contenido generado por IA)
        const yo = jugador_(d.id);
        if (!yo) return responder_({ ok: false, error: 'sin-sincronizar' });
        const l = limites_(yo);
        if ((l.reportes || 0) >= REPORTES_DIA) return responder_({ ok: false, error: 'limite' });
        l.reportes = (l.reportes || 0) + 1;
        yo.limites = JSON.stringify(l);
        escribir_('Jugadores', yo);
        escribir_('Reportes', { fecha: new Date(), id: d.id, dia: texto_(d.dia, 10), texto: texto_(d.texto, 800), motivo: texto_(d.motivo, 60) });
        return responder_({ ok: true });
      }
      default:
        return responder_({ ok: false, error: 'accion' });
    }
  } finally {
    candado.releaseLock();
  }
}

// ---------- Diario con IA (opcional) ----------
/**
 * Ejecútala UNA VEZ desde el editor (selecciónala arriba y pulsa ▶ Ejecutar) después de poner ANTHROPIC_API_KEY:
 * Google te pedirá permiso para "conectarse a un servicio externo" y verás en el registro una página de prueba.
 */
function probarIA() {
  const yo = filas_('Jugadores')[0];
  if (!yo) { Logger.log('Primero tiene que haber al menos un jugador sincronizado.'); return; }
  const r = diario_({ id: yo.id, nombre: 'Prueba', especie: 'dog', registro: { acciones: { feed: 1, pet: 3 }, comidas: ['filete'] } });
  Logger.log(r.ia ? 'IA OK: ' + r.texto : 'La IA no respondió (¿falta la clave o se pasó el tope diario?): ' + JSON.stringify(r));
}
/**
 * Escribe una página del diario con Claude a partir de lo que vivió la mascota ese día.
 * No recibe ningún texto escrito por el jugador: solo datos del juego (comidas, juegos, contadores).
 * Devuelve { ok: true, ia: false } si no hay clave, se pasó el tope o algo falla: el juego usa su diario local.
 */
function diario_(d) {
  const clave = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!clave) return { ok: true, ia: false };
  // Tope diario por jugador (con candado solo lo justo)
  const candado = LockService.getScriptLock();
  candado.waitLock(10000);
  try {
    const yo = jugador_(d.id);
    if (!yo) return { ok: true, ia: false };
    const l = limites_(yo);
    if ((l.diarios || 0) >= DIARIOS_DIA) return { ok: true, ia: false };
    l.diarios = (l.diarios || 0) + 1;
    yo.limites = JSON.stringify(l);
    escribir_('Jugadores', yo);
  } finally {
    candado.releaseLock();
  }
  const r = d.registro || {};
  const acciones = {};
  ['feed', 'pet', 'bathe', 'walk', 'train', 'play'].forEach((k) => { const n = num_((r.acciones || {})[k], 50); if (n) acciones[k] = n; });
  const lista = (v, n, max) => (Array.isArray(v) ? v : []).slice(0, n).map((x) => texto_(x, max)).filter(Boolean);
  const hechos = {
    nombre: texto_(d.nombre, 16),
    especie: ESPECIES.indexOf(d.especie) >= 0 ? d.especie : 'dog',
    etapa: texto_(d.etapa, 12),
    sexo: d.sexo === 'female' ? 'hembra' : 'macho',
    rasgos: (Array.isArray(d.rasgos) ? d.rasgos : []).filter((x) => RASGOS.indexOf(x) >= 0),
    vinculo: num_(d.vinculo, 100),
    acciones: acciones,
    comidas: lista(r.comidas, 8, 30),
    juegos: lista(r.juegos, 6, 30),
    novedades: lista(r.novedades, 3, 80),
    leGusta: lista(d.leGusta, 3, 30),
  };
  const sistema = 'Eres la voz de una mascota virtual en un juego para todas las edades. Escribes una página de su diario ' +
    'en primera persona, en español neutro, tierna y con humor suave, de 2 a 4 frases (máximo 70 palabras) y como mucho 2 emojis. ' +
    'Usa solo los hechos que te dan; no inventes personas, lugares ni sucesos. Llama a quien te cuida "mi persona". ' +
    'No menciones que eres una IA ni hables de temas sensibles. Responde solo con el texto de la página.';
  const modelo = PropertiesService.getScriptProperties().getProperty('MODELO_IA') || 'claude-haiku-5-5';
  const cuerpo = {
    model: modelo,
    max_tokens: 2000,
    output_config: { effort: 'low' },
    system: sistema,
    messages: [{ role: 'user', content: 'Hechos del día (JSON): ' + JSON.stringify(hechos) }],
  };
  const cabeceras = { 'x-api-key': clave, 'anthropic-version': '2023-06-01' };
  // Haiku no tiene reintento en otro modelo; Opus/Sonnet sí: si se niega, Anthropic prueba con el modelo recomendado
  if (modelo.indexOf('haiku') < 0) {
    cuerpo.fallbacks = 'default';
    cabeceras['anthropic-beta'] = 'server-side-fallback-2026-07-01';
  }
  try {
    const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      headers: cabeceras,
      payload: JSON.stringify(cuerpo),
    });
    if (res.getResponseCode() !== 200) return { ok: true, ia: false };
    const m = JSON.parse(res.getContentText());
    if (m.stop_reason === 'refusal') return { ok: true, ia: false };
    const texto = (m.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    return texto ? { ok: true, ia: true, texto: texto_(texto, 600) } : { ok: true, ia: false };
  } catch (err) {
    return { ok: true, ia: false };
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
    case 'metricas':
      return responder_(metricas_());
    default:
      prepararHojas();
      return responder_({ ok: true, servidor: 'Patitas', version: 4 });
  }
}

// ---------- Métricas (solo números agregados, sin IDs) ----------
function metricas_() {
  const ev = filas_('Eventos');
  const dia = (x) => (x instanceof Date ? Utilities.formatDate(x, 'GMT', 'yyyy-MM-dd') : String(x).slice(0, 10));
  const diaMas = (d, n) => Utilities.formatDate(new Date(new Date(d + 'T00:00:00Z').getTime() + n * 864e5), 'GMT', 'yyyy-MM-dd');
  const activos = {};   // id -> Set de días con sesión
  const conteo = {};    // evento -> veces
  const detalle = {};   // evento:dato -> veces (etapas, minijuegos, compras...)
  ev.forEach((f) => {
    const d = dia(f.dia), e = String(f.evento);
    conteo[e] = (conteo[e] || 0) + 1;
    if (f.dato) detalle[e + ':' + f.dato] = (detalle[e + ':' + f.dato] || 0) + 1;
    if (e === 'sesion') (activos[f.id] = activos[f.id] || {})[d] = true;
  });
  const hoy = hoy_();
  const cohortes = {};
  Object.keys(activos).forEach((id) => {
    const dias = Object.keys(activos[id]).sort();
    const c = (cohortes[dias[0]] = cohortes[dias[0]] || { nuevos: 0, d1: 0, d3: 0, d7: 0 });
    c.nuevos++;
    [1, 3, 7].forEach((n) => { if (activos[id][diaMas(dias[0], n)]) c['d' + n]++; });
  });
  const ultimos = {};
  for (let i = 13; i >= 0; i--) {
    const d = diaMas(hoy, -i);
    ultimos[d] = Object.keys(activos).filter((id) => activos[id][d]).length;
  }
  return { ok: true, hoy, jugadores: Object.keys(activos).length, activosPorDia: ultimos, cohortes, eventos: conteo, detalle };
}
