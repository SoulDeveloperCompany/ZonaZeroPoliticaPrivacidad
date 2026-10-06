# Patitas — guía corta para Claude

Juego 2D de mascota virtual (TypeScript + Vite, sin frameworks) empaquetado para Android con Capacitor 8.
Está en `mascota-virtual/`; el resto del repo es la política de privacidad de Zona Cero. Todo en **español**.
El usuario quiere gastar pocos tokens: respuestas cortas, no leer archivos enteros, usar los scripts de abajo.

## Cómo trabajar (ahorra tokens) — comandos dentro de `mascota-virtual/`
- Antes de buscar a mano: `npm run -s mapa -- <palabra>` da clases, funciones y métodos con número de línea
  (`--archivos` lista los archivos con su tamaño y descripción). Luego lee solo ese rango.
- Después de cambiar algo: `npm run -s revisar` (tipos, tests, Apps Script simulado, URL del servidor, versión,
  llave fuera de git). Imprime solo los problemas o «Todo bien».
- Ver el juego sin navegador: `npm run artifact` y luego `npm run -s shot -- <carpeta> new:dog:Toby close wait:4000 shot:casa`
  (pasos en `scripts/shot.mjs`; `--play` = capturas 1080x1920 para Play Store; nunca escribe en la hoja real).
  Unir capturas en una imagen: `python scripts/sheet.py hoja.png a.png b.png`.
- Probar en el navegador: preview «patitas» (`.claude/launch.json`, Vite en el puerto 5173; sprites en /sprites.html).
- Gráficos con los sprites reales: `npm run graficos` (icono y gráfico de Play en `play-store/`, icono y splash
  de la app en `recursos/`) y luego `npm run android:iconos` para pasarlos a Android.
- Ediciones grandes: script de Python con `replace` y comprobación de que el texto aparece 1 vez.
- `README.md` de mascota-virtual tiene la arquitectura completa: leer solo la sección necesaria.

## Archivos
- Diseño "tipo Unity" pedido por el usuario: datos como ScriptableObjects en `src/data/` (registrados en `DataRegistry`),
  managers Singleton (`static get instance()`), eventos con `EventBus` (`src/core/EventBus.ts`), bucle en `GameManager.tick()`.
- Balance (degradación, precios, tiempos): `src/core/GameConfig.ts`. Estado serializable: `src/core/GameState.ts`.
- Sistemas en `src/systems/<sistema>/`; pantallas en `src/ui/screens/`; minijuegos en `src/ui/minigames/`.
- Sprites SVG generados por código: `src/sprites/PetSprite.ts` (`DRAWERS` por especie) y `Accessories.ts`.
- Nueva especie/objeto/competencia: ver "Cómo ampliar el juego" en `mascota-virtual/README.md`.
- No hay nada simulado: el usuario pidió quitar visitantes, parejas, rivales y adopciones falsas.

## Servidor (Google Sheets + Apps Script)
- Hoja "Patitas servidor" (cuenta alex.san.otaku@gmail.com): https://docs.google.com/spreadsheets/d/1Hz-FbeSrxDi3s-e4W1WRyfHUmvwj8REp6tw6mi-2-sw/edit
- Script `mascota-virtual/server/patitas-apps-script.js` (guía `server/LEEME.md`), desplegado como "Patitas v1".
  URL en `src/core/OnlineConfig.ts`. Si cambias el script: Implementar › Gestionar implementaciones › ✏️ › Versión nueva.
- Cliente: `src/systems/online/OnlineService.ts`. Pestañas: Jugadores, Adopciones, Parejas, Puntajes, Regalos
  (Regalos la rellena el dueño: `para` = ID del jugador o `todos`, `activo` = SI).
- Los tests ponen `OnlineConfig.DEFAULT_URL = ''` y `shot` bloquea script.google.com: nunca escribir en la hoja real.
- Borrado de datos a petición (política de privacidad): quitar a mano las filas de ese ID en la hoja.

## Compilar y publicar
- Doble clic en `mascota-virtual\COMPILAR PARA PLAY.bat` (o `npm run publicar`): revisa, sube versionName
  (1.1.0 → 1.2.0; `-Parche` → 1.1.1; `-SinSubir`), compila SIN herramientas de prueba (`VITE_TIENDA=1`) y deja
  `android\app\build\outputs\bundle\release\app-release.aab` firmado; abre la carpeta y Play Console.
- La contraseña de la llave (`Documents\llaves\patitas-subida.jks`, alias `patitas`) la escribe el usuario en la
  ventanita. Nunca leerla ni guardarla. `android\keystore.properties` no va a git.
- `PROBAR EN CELULAR (APK).bat` (o `npm run apk`): APK de prueba `...patitas.prueba`, con herramientas de prueba.
- Usa el Java 21 de `Documents\herramientas-android` y el SDK de Android de Unity (Build-Tools 36), como Mi Zoológico.
- Web: `bash scripts/deploy-pages.sh` publica en https://souldevelopercompany.github.io/ZonaZeroPoliticaPrivacidad/
  junto con `public-pages/privacidad.html` (política de Patitas usada en Play Store).
- Play Console: cuenta "Soul Hope", app ID 4971985063553773767. Ficha y declaraciones en `mascota-virtual/play-store/FICHA.md`.
  Cuenta personal: hace falta prueba cerrada con 12 testers durante 14 días antes de pedir producción.

## Reglas
- Rama de trabajo `claude/virtual-pet-game-logic-osqaa4` (PR #2 en borrador hacia `main`). Los commits llevan
  `[skip ci]` para no lanzar `.github/workflows/android-apk.yml`.
- Público 13+ (fuera del programa Familias). Sin anuncios ni compras con dinero real (así está declarado en Play).
- Textos neutros en género para la mascota ("tu mascota", "la/le"). El usuario prueba en el móvil (vertical).
- El artefacto de Claude (https://claude.ai/artifact/GoqHK8f5ztPptcQw511WBu) no puede conectarse al servidor;
  el multijugador se prueba en GitHub Pages o en el APK.

## Pendiente
- Prueba cerrada «Alpha» enviada a revisión el 5 oct 2026 (v1.1.0, 178 países, listas «Testers Mi Zoológico» y
  «Yo interna», como Zoo). Cuando la aprueben: 12 testers × 14 días y luego pedir acceso a producción.
  Las próximas versiones se suben a ese mismo canal (Prueba cerrada › Crear nueva versión).
- Añadir como colaborador en GitHub a `carloseduardobonillapalma-lgtm` (Settings › Collaborators).
- Ideas: notificaciones locales en Android, sonidos, nombre definitivo.
