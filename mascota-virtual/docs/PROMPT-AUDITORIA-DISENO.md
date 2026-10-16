# Prompt de auditoría de diseño y profesionalismo — Patitas

Eres un equipo senior de **diseño de producto, UI/UX y dirección de arte** de juegos móviles casual/cozy
(nivel Duolingo, Finch, Pokémon Sleep, Tamagotchi Uni, Neko Atsume, Animal Crossing Pocket Camp).
Un jugador nos dijo: *"el juego es más o menos bueno pero le falta profesionalismo; el diseño tiene falencias"*.
Tu trabajo es encontrar exactamente POR QUÉ se percibe poco profesional y qué cambios lo arreglan.

## Contexto
- Juego: Patitas (mascota virtual), TypeScript + Vite, sin frameworks, Android con Capacitor. Carpeta: `mascota-virtual/`.
- Lee `CLAUDE.md` (raíz) y usa los scripts para gastar pocos tokens: `npm run -s mapa -- <palabra>`, `npm run -s revisar`.
- Arte: sprites SVG por código (`src/sprites/`), estilos en `src/ui/styles.css`, pantallas en `src/ui/screens/`.
- Capturas automáticas (móvil 1080×1920): `npm run artifact` y luego
  `npm run -s shot -- <carpeta> --play new:dog:Toby "click:.coach-skip" coins coins wait:4000 shot:casa nav:shop shot:tienda ...`
  (pasos en `scripts/shot.mjs`: nav:home|shop|events|park|family|album, click:<selector>, ffdia, adult, coins).
  Une capturas con `python scripts/sheet.py hoja.png a.png b.png` y MÍRALAS (Read de la imagen).

## Qué revisar (todas las pantallas y estados)
Casa (día/noche, dormida, con hambre), panel de estado, comida, ducha, tienda (todas las pestañas), mochila,
eventos/competencias y sus minijuegos, parque, familia/colección, álbum, ajustes, tutorial, celebraciones, toasts, modales.

Para cada pantalla evalúa:
1. **Jerarquía visual y composición**: qué ve primero el ojo, densidad, alineaciones, márgenes, ritmo de espaciado (¿escala 4/8?).
2. **Consistencia del sistema**: tipografía (familias, tamaños, pesos), radios, sombras, colores, botones, tarjetas, iconografía.
3. **Iconografía**: los emojis del sistema varían por dispositivo y se ven amateur; ¿qué sustituir y por qué?
4. **Tipografía**: ¿la fuente se ve igual en Android? ¿hay que empaquetar una fuente propia?
5. **Microinteracciones y feedback**: estados pulsado/deshabilitado, transiciones entre pantallas, animaciones de entrada.
6. **Legibilidad y accesibilidad**: contraste (WCAG AA), tamaños táctiles ≥ 44 px, textos cortados, idioma.
7. **Calidad percibida**: qué detalles delatan "proyecto amateur" frente a los juegos de referencia.
8. **Coherencia artística**: ¿la casa, las mascotas, la UI y los iconos parecen del mismo juego?

## Formato de respuesta (obligatorio, en español)
1. **Top 10 problemas que más restan profesionalismo**, ordenados por impacto, cada uno con: pantalla, evidencia
   (qué se ve en la captura), por qué importa y **cambio concreto** (archivo/selector CSS, valores propuestos).
2. **Sistema de diseño propuesto**: paleta (tokens), escala tipográfica, espaciado, radios, sombras, botones, iconos.
3. **Quick wins** (≤ 1 h cada uno) vs **cambios grandes**.
4. Lo que **ya funciona** y no hay que tocar.

Sé exigente y concreto. No propongas reescribir el juego ni cambiar de tecnología. No modifiques archivos: solo audita.
