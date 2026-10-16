# Evolución de Patitas — ciclo 16 oct 2026

## Diagnóstico (antes de tocar nada)
1. **La mascota no aprendía ni recordaba nada y nunca hablaba.** Sus conductas dependían solo de sus
   necesidades y su carácter. Tocarla era un único "acariciar" sin zonas.
2. **Minijuegos planos**: fondo beige vacío, mascota diminuta, sin combos, partículas ni sonido de acierto.
   Al pulsar "Salir", el juego seguía funcionando por detrás.
3. **Arte incoherente**: los muebles eran emojis pegados sobre una habitación dibujada en SVG, y lo mismo pasaba
   con la navegación y el monedero (ya resuelto en el ciclo anterior).
4. **Resultado de minijuego pobre**: un 🎉 y un número. Con 0 puntos decía "¡Muy bien!".
5. **Sin música.**

## Qué se hizo
| Área | Cambio | Comprobado |
|---|---|---|
| IA de la mascota | `PetMind`: aprendizaje por refuerzo (bandido) de conductas, rutina horaria, gustos innatos que se descubren, vocabulario que crece con la edad y el vínculo (el loro aprende el doble de rápido), recuerdos que menciona | 7 tests + captura jugando |
| Vida | Caricias por zonas (cabeza = mimos, barriga = cosquillas, 6 toques = mareo, arrastrar = caricias), ojos que siguen el dedo, bocadillos de habla, estirarse y bailar | Capturas |
| Ficha | "🧠 Lo que ha aprendido de ti": palabras, lo que sabe que te gusta, tu hora habitual y sus gustos | Captura |
| Minijuegos | Combos ×4, golosina dorada con "modo fiebre", lluvia final, picnic con nubes, paralaje, huesos en el aire, estirar/aplastar al saltar, polvo al aterrizar, sacudidas, sonidos que suben de tono | Capturas a mitad de partida |
| Resultado | Mascota feliz, valoración frente a tu récord, puntuación que cuenta hacia arriba, confeti en récord | Captura |
| Arte | 5 muebles en SVG (casa y tienda), precios con monedas y estrellas propias | Capturas |
| Música | Nana generativa (sin archivos), baja durante los minijuegos, interruptor en Ajustes | Sin errores; **no escuchada** |

## Autoevaluación (1-10, antes → después)
Leyenda: **C** = comprobado (tests o capturas jugando) · **I** = inspeccionado en código · **H** = hipótesis.

| Criterio | Nota | Por qué |
|---|---|---|
| Diversión inmediata | 5 → 6,5 | C: combos, fiebre y premios en el aire funcionan. H: hace falta sentirlo en un móvil |
| Calidad de las mecánicas | 6 → 6,5 | C: dificultad creciente, riesgo y recompensa en el Saltarín. Los juegos de memoria y vasos no se tocaron |
| Calidad artística | 5 → 7 | C: iconos, muebles y escenarios coherentes. Quedan emojis en comidas, obstáculos y tarjetas de juego |
| Personalidad | 5 → 7,5 | C: habla, aprende, tiene gustos y recuerda. Es el mayor salto |
| Fluidez de animaciones | 6 → 6,5 | I: hay anticipación e impacto en saltos y caricias. Las capturas no permiten juzgar el movimiento |
| Interfaz | 5,5 → 7 | C: contraste, iconos, pestañas y resultado |
| Sensación de progreso | 6,5 → 7 | C: vocabulario y gustos son metas nuevas a largo plazo |
| Variedad y rejugabilidad | 6 → 6,5 | Los mismos 9 minijuegos, mejor acabados |
| Rendimiento y estabilidad | 7 → 7 | C: 68 tests y sin errores en el navegador. H: falta medir en un Android de gama baja |
| Diferenciación comercial | 4 → 6,5 | "La mascota que aprende de ti" es un gancho claro para vídeos cortos |

## Las 3 debilidades más importantes que quedan
1. **Sin prueba en un móvil real**: música, sonidos, vibración y fluidez de los minijuegos.
2. **Emojis restantes** en comidas, objetos de los minijuegos y tarjetas: rompen la coherencia que ya tienen la casa y la navegación.
3. **Profundidad del habla**: frases por plantilla. Es suficiente para dar vida, pero no hay conversación libre.

## ¿IA en la nube? (decisión del dueño)
Lo implementado es una IA **local** que aprende de verdad: gratis, sin internet, privada y sin requisitos de Google Play.
Una IA en la nube (por ejemplo, Claude Haiku a través del Apps Script, con la clave guardada en las
Propiedades del script, nunca en la app) permitiría que la mascota escribiera un **diario diario** o mantuviera una conversación libre. Implica:
- **Coste** por uso (pequeño con Haiku, pero real): hay que poner límite diario por jugador.
- **Google Play**: las apps con contenido generado por IA deben incluir un botón para denunciar respuestas ofensivas.
  Además, hay que actualizar la política de privacidad y la Seguridad de los datos.
- **Público 13+**: mejor sin chat libre. Lo más seguro es el **diario** (la IA solo recibe los recuerdos de la mascota, sin texto del jugador).

Recomendación: primero publicar y medir la v1.4.0 con la IA local. Si los jugadores responden bien, añadir el diario con IA como función Premium opcional.
