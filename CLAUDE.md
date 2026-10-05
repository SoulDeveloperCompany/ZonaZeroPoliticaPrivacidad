# Contexto para Claude — juego "Patitas"

Este repositorio tenía solo la política de privacidad de Zona Cero (`Privacidad`, `README.md`).
Ahora contiene además **Patitas** (nombre provisional), un juego 2D de mascota virtual para Android,
en la carpeta `mascota-virtual/`. Dueño: SoulDeveloperCompany. Todo se escribe en **español**.

## Estado actual

- Rama de trabajo: `claude/virtual-pet-game-logic-osqaa4` (PR #2 en borrador hacia `main`).
- Tecnología: TypeScript + Vite (sin frameworks), empaquetado a Android con Capacitor.
  El usuario pidió el diseño "tipo Unity": datos como ScriptableObjects (`src/data/`), managers
  Singleton (`static get instance()`), comunicación con `EventBus` (equivalente a C# events).
- Leer `mascota-virtual/README.md` para la arquitectura completa y la tabla de sistemas.
- Hecho: mascota (6 especies, stats, escape a las 48 h), crecimiento por etapas, cuidados (comida
  arrastrable, ducha con jabón y agua, acariciar tocando, sueño autónomo), tienda, competencias con
  minijuegos, 6 minijuegos de "Jugar" por etapa, misiones diarias, crianza con herencia, rancho,
  álbum, guardado con tiempo offline, casa a pantalla completa con animación en reposo.
- Multijugador: **Google Sheets + Apps Script** (patrón copiado de su otro juego
  `SoulDeveloperCompany/mi-zoologico`, archivo `guia/ranking-apps-script.js`).
  Script: `mascota-virtual/server/patitas-apps-script.js`. Guía: `mascota-virtual/server/LEEME.md`.
  Cliente: `src/systems/online/OnlineService.ts`. URL por defecto en `src/core/OnlineConfig.ts`.
  Pestañas: Jugadores, Adopciones, Parejas, Puntajes, Regalos (esta la rellena el dueño a mano:
  `para` = ID del jugador o `todos`, `activo` = SI). El ID del jugador se ve en Ajustes › Servidor.
- No hay nada simulado: el usuario pidió quitar visitantes, parejas, rivales y adopciones falsas.

## Lo que queda pendiente (empezar por aquí)

1. ~~Desplegar el Apps Script~~ **Hecho (4 oct 2026).** Hoja "Patitas servidor" (cuenta alex.san.otaku@gmail.com):
   https://docs.google.com/spreadsheets/d/1Hz-FbeSrxDi3s-e4W1WRyfHUmvwj8REp6tw6mi-2-sw/edit
   Proyecto Apps Script "Patitas servidor", implementación "Patitas v1" (Aplicación web · Ejecutar como: Yo ·
   Acceso: Cualquier usuario). URL ya puesta en `OnlineConfig.DEFAULT_URL`:
   https://script.google.com/macros/s/AKfycbzmvc4tmCEkbueoR9mStgu76KszxhMY_RBHu7bBe3keccAw-EEML4QzEHzOTKxNV1VlxQ/exec
   Si cambias el script: Implementar › Gestionar implementaciones › ✏️ › Versión nueva (así la URL no cambia).
   Los tests ponen `OnlineConfig.DEFAULT_URL = ''` en `beforeEach` para no escribir en la hoja real.
2. ~~Conectar la URL y comprobar las pestañas~~ **Hecho:** se crearon Jugadores, Adopciones, Parejas, Puntajes y Regalos.
3. ~~Volver a publicar la web~~ **Hecho:** `bash scripts/deploy-pages.sh` (rama `gh-pages`) →
   https://souldevelopercompany.github.io/ZonaZeroPoliticaPrivacidad/
4. Añadir como colaborador en GitHub a `carloseduardobonillapalma-lgtm` (Settings › Collaborators).
5. **Play Store (5 oct 2026):** app "Patitas" creada en la cuenta "Soul Hope" (ID app 4971985063553773767),
   ficha, configuración de la tienda y TODAS las declaraciones completas (ver `mascota-virtual/play-store/FICHA.md`).
   Falta: quitar "Herramientas de prueba", generar AAB firmado, subirlo a prueba cerrada (12 testers × 14 días).
6. Ideas aún no hechas: notificaciones locales en Android, sonidos, icono propio, nombre definitivo,
   firma y publicación en Google Play.

## Comandos (dentro de `mascota-virtual/`)

```bash
npm install
npm run dev            # http://localhost:5173  (sprites: /sprites.html)
npm test               # tests de la lógica (vitest)
npm run typecheck
npm run test:server    # prueba el Apps Script con una hoja simulada
npm run artifact       # artifact/patitas.html (todo en 1 archivo) y artifact/preview.html
npm run shot -- <carpeta> new:dog:Toby shot:casa ...   # capturas móviles automáticas (ver scripts/shot.mjs)
bash scripts/deploy-pages.sh                            # publica en GitHub Pages
python3 scripts/make-sheet-template.py                  # regenera server/plantilla-patitas.xlsx
npm run android:sync && npm run android:open            # APK con Android Studio
```

## Preferencias del usuario

- Respuestas y textos del juego en español; el usuario prueba en el móvil (pantalla completa vertical).
- Quiere gastar pocos tokens: usar los scripts de arriba (artifact, shot, sheet) en vez de comandos largos.
- **No compilar el APK** salvo que lo pida: los commits llevan `[skip ci]` para no lanzar
  el workflow `.github/workflows/android-apk.yml`.
- Versión jugable publicada también como artefacto de Claude:
  https://claude.ai/artifact/GoqHK8f5ztPptcQw511WBu (no puede conectarse al servidor: el visor bloquea
  peticiones externas; el multijugador se prueba en GitHub Pages, en el navegador normal o en el APK).
- Textos neutros en género cuando se habla de la mascota ("tu mascota", "la/le").
