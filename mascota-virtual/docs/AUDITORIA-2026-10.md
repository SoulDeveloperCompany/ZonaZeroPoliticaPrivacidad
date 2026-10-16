# Auditoría de Patitas — octubre 2026 (v1.1.0)

Leyenda de evidencia: **[D] demostrado** (simulado con el código real o leído en el código), **[H] hipótesis** (razonable, sin datos todavía), **[O] oportunidad** (idea nueva). No hay métricas de jugadores: ninguna cifra de retención o ingresos de este documento está medida.

---

## 0. Resumen en 6 líneas

1. **El juego castiga la vida normal del jugador [D].** Una mascota perfectamente cuidada se escapa si no abres el juego ~20-24 h, y a las ~72 h **se pierde para siempre**. Es la causa de abandono más probable y contradice el principio de "volver por gusto, no por miedo".
2. **El ciclo de vida dura 2 días [D].** 1 h real = 1 día: adulto a las 14 h, senior a las 45 h. Quien instala por la noche se despierta con un juvenil y nunca vio a su bebé. No hay nada que descubrir después de la primera semana.
3. **El servidor permite fabricar monedas infinitas y falsear rankings [D]** (adopciones de hasta 5.000 🪙 que nadie paga; puntajes sin validar).
4. **Una partida corrupta deja el juego inutilizable para siempre [D]** (muestra un error al arrancar y no hay copia de respaldo).
5. **Las mascotas son bonitas pero no tienen personalidad ni memoria [D]**: comportamiento en reposo aleatorio, sin vínculo, sin sonido, sin tutorial, hitos mostrados como avisos de 2 s.
6. **No se mide nada [D]**: sin métricas no se puede validar ninguna mejora ni ninguna monetización.

Lo bueno, y se conserva: arte SVG coherente y tierno, arquitectura limpia y testeada (34 tests), ducha y comida táctiles, herencia genética real, comercio entre jugadores con base sencilla, cero anuncios y cero pay-to-win.

---

## 1. Hallazgos críticos (bloquean la retención o la integridad)

### C1. Ausencia = castigo y pérdida permanente [D]
Simulación con el código real (perro bien cuidado: hambre 5, resto 100) y el jugador fuera:

| Horas fuera | Etapa al volver | Hambre | Felicidad | Higiene | Salud | Estado |
|---|---|---|---|---|---|---|
| 4 | Cachorro | 34 | 79 | 83 | 100 | en casa |
| 8 | Juvenil | 63 | 58 | 66 | 100 | en casa |
| 12 | Juvenil | 91 | 37 | 50 | 86 | en casa |
| 16 | Adulto | 100 | 20 | 36 | 50 | en casa |
| 24 | Adulto | 100 | 0 | 19 | 0 | **escapada** |
| 72 | — | — | — | — | — | **perdida para siempre** |

- Una jornada de trabajo más la noche basta para que se escape; un fin de semana fuera, para perderla (`PetManager.checkEscapeExpired`, evento `pet:lostForever`).
- El jugador que vuelve tras unos días (justo el que queremos recuperar) encuentra una mala noticia. Es el peor momento posible para castigar.
- El Collar GPS (300 🪙) existe solo para aliviar un problema creado por el propio juego.

### C2. Ritmo de vida demasiado rápido [D]
- `REAL_MS_PER_GAME_DAY = 1 h`. Bebé 0-3 h, cachorro 3-7 h, juvenil 7-14 h, adulto 14 h, senior 45 h.
- Las etapas, que deberían ser los grandes hitos emocionales, pasan mientras el jugador duerme. Con 14 Vitaminas (1.120 🪙) el bebé es adulto al instante.
- Los senior no pueden criar: a los 2 días la mascota inicial queda fuera del sistema más profundo del juego.

### C3. Fraude económico en el servidor [D, leído en `server/patitas-apps-script.js`]
- `publicarAdopcion` acepta cualquier `precio` hasta 5.000; `adoptar` no comprueba que el comprador pague (el pago lo descuenta el cliente). Con dos IDs y dos peticiones HTTP se ingresan 5.000 🪙 en `pendiente`, repetible sin límite. Lo mismo con `tarifa` de parejas (hasta 2.000).
- `puntaje` acepta 100 directamente: el ranking global se puede llenar de puntuaciones perfectas.
- No lo probé contra el servidor real (no ataco producción); está demostrado por lectura del código.

### C4. Partida corrupta = juego inutilizable [D]
- `SaveSystem.load` no tiene alternativa si `JSON.parse` falla: `main.ts` muestra "Error al iniciar el juego" en cada arranque y no hay forma de seguir jugando.
- Se guarda en una sola clave, sin copia de respaldo; un guardado interrumpido (batería, cierre forzado) puede dejarla truncada [H sobre la frecuencia].

### C5. Cero medición [D]
No hay eventos de uso: no sabemos cuántos completan el primer día, en qué etapa abandonan ni qué minijuegos se usan. Play Console solo da instalaciones/desinstalaciones y estabilidad.

---

## 2. Hallazgos importantes

### Primera sesión y comprensión
- **Sin tutorial [D]**: `tutorialDone` existe en el estado pero no se usa en ningún sitio. No se explica que el tiempo corre con la app cerrada ni qué desbloquea cada etapa.
- **Primeros minutos densos [H]**: 6 botones de acción + 6 pestañas a la vez; varias acciones aparecen bloqueadas con candado desde el primer segundo.

### Vida y personalidad
- **Comportamiento en reposo aleatorio [D]** (`HomeScreen.idleBehavior`): pasear, saltar, ladear la cabeza, mirar o menearse al azar cada 3,5-7 s. Solo "bostezar si tiene sueño" responde al estado. No mira el cuenco si tiene hambre, ni se rasca si está sucia, ni viene hacia ti.
- **Sin personalidad ni vínculo [D]**: no existen rasgos, preferencias aprendidas, confianza ni memoria de interacciones. Dos perros con los mismos genes se comportan igual.
- **Especies poco diferenciadas en conducta [D]**: cambian sus números base y sus trucos, pero no su forma de moverse ni de reaccionar.

### Presentación y "juice"
- **Sin sonido ni vibración [D]** (no hay ningún audio ni haptics en el código). Es la mayor diferencia de calidad percibida frente a otros juegos de mascotas, y la más barata de cerrar.
- **Hitos como avisos [D]**: "¡Toby ha crecido! Ahora es Adulto" es un toast de unos segundos. Crecer, nacer una cría o ganar un concurso merecen una pantalla de celebración con foto para el álbum.
- **Arte [D]**: SVG por código, coherente, tierno y ligero; 8 estados de ánimo, parpadeo y ~13 animaciones CSS. Falta lenguaje corporal (orejas, cola, postura) y expresiones de afecto. No hace falta cambiar la dirección artística: hay que darle más gestos.

### Economía [D, calculado con los datos actuales]
- Juvenil o adulto activo: ~700 🪙/día. Lo más caro de la tienda cuesta 300 🪙. **A partir del día 3-4 las monedas pierden valor.**
- Estrellas: ~1,5 ⭐/día; todo lo que cuesta estrellas suma 26 ⭐. **En ~2 semanas las estrellas no sirven para nada.**
- **No se puede vender** nada; la comida básica gratis e ilimitada hace casi irrelevante la comida de pago.
- **Exploit de reloj [D]**: recompensa diaria, misiones y topes de minijuegos usan la hora del teléfono; adelantar la fecha los reinicia. En un juego para un jugador es menor, pero con comercio y ranking afecta a los demás.

### Social
- El parque solo muestra mascotas que se pueden saludar; no hay amistad, visitas ni nada cooperativo [D]. Con ~20 testers, cualquier sistema social complejo estaría vacío [H]: hay que empezar por lo asíncrono.

### Técnico (menor)
- El servidor lee hojas completas en cada petición y bloquea todas las escrituras con un candado global [D]; vale para decenas de jugadores, no para miles [H]. Las filas de Jugadores nunca se limpian [D].
- La eliminación de datos se hace a mano en la hoja [D].
- Accesibilidad: hay `prefers-reduced-motion`, pero pocos `aria-label` (9) [D]; falta revisar contraste y tamaños [H].

---

## 3. Puntuación por área (1-10)

Criterios: **Calidad** = estado actual; **Importancia** = peso para el jugador; **Potencial** = cuánto puede mejorar con coste razonable; **Riesgo** = riesgo de tocarlo (alto = cuidado).

| Área | Calidad | Importancia | Potencial | Riesgo | Comentario |
|---|---|---|---|---|---|
| Arte de mascotas | 7 | 9 | 7 | 3 | Bonito y coherente; faltan gestos y lenguaje corporal |
| Animación y feedback (sonido, vibración, celebraciones) | 4 | 8 | 9 | 2 | Lo más barato con más impacto en calidad percibida |
| Cuidados táctiles (comer, ducha, caricias) | 7 | 8 | 6 | 3 | Buen núcleo; mantener |
| Simulación de vida / personalidad | 3 | 10 | 9 | 5 | Es lo que convierte botones en "mi mascota" |
| Apego emocional (vínculo, recuerdos) | 3 | 10 | 9 | 4 | Álbum existe pero es pasivo |
| Ritmo y progresión | 2 | 10 | 9 | 7 | Ciclo de 2 días; necesita migración cuidadosa |
| Castigo por ausencia | 1 | 10 | 10 | 4 | Crítico |
| Primera sesión / tutorial | 3 | 9 | 8 | 2 | No existe |
| Economía y tienda | 4 | 7 | 8 | 5 | Monedas y estrellas sin destino a medio plazo |
| Crianza y genética | 6 | 8 | 8 | 4 | Base sólida; faltan variantes raras y colección |
| Competencias / ranking | 5 | 6 | 6 | 3 | Repetitivo y falsificable |
| Social / comercio | 4 | 6 | 6 | 5 | Base buena, inseguro |
| Integridad del servidor | 2 | 8 | 9 | 3 | Crítico |
| Robustez del guardado | 4 | 10 | 9 | 3 | Crítico (sin respaldo) |
| Métricas | 0 | 8 | 10 | 2 | Requisito para todo lo demás |
| Monetización | — | 6 | 7 | 6 | No existe; no debe ser lo primero |

---

## 4. Matriz de prioridades

Escala 1-5 (5 = más). Coste y riesgo: 5 = más caro o arriesgado. **Valor** = (diversión + apego + retención + rentabilidad + alcance) − (coste + riesgo).

| # | Propuesta | Divers. | Apego | Retenc. | Rentab. | Alcance | Coste | Riesgo | Valor | Depende de |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Sin castigo por ausencia (suelos offline, sin pérdida permanente) | 3 | 5 | 5 | 3 | 5 | 1 | 1 | **19** | — |
| 2 | Guardado robusto con respaldo | 1 | 3 | 4 | 2 | 5 | 1 | 1 | **13** | — |
| 3 | Servidor anti-fraude | 2 | 1 | 3 | 3 | 4 | 2 | 1 | **10** | — |
| 4 | Métricas mínimas anónimas | 1 | 1 | 3 | 4 | 5 | 2 | 1 | **11** | política de privacidad |
| 5 | Nuevo ritmo de vida (días reales) + migración | 4 | 5 | 5 | 3 | 5 | 3 | 3 | **16** | 1 |
| 6 | Primera sesión guiada | 3 | 3 | 5 | 2 | 5 | 2 | 1 | **15** | 5 |
| 7 | Sonido + vibración + celebraciones de hitos | 5 | 4 | 3 | 2 | 5 | 2 | 1 | **16** | — |
| 8 | Vínculo + rasgos + conducta contextual | 5 | 5 | 5 | 3 | 5 | 4 | 3 | **16** | 5 |
| 9 | Recuerdos y cumpleaños | 3 | 5 | 4 | 2 | 5 | 2 | 1 | **16** | 8 |
| 10 | Rebalance economía + decoración de casa | 4 | 3 | 4 | 4 | 4 | 3 | 2 | **14** | 4 |
| 11 | Colección genética (variantes raras, libro de pelajes) | 4 | 4 | 5 | 3 | 3 | 3 | 2 | **14** | 3, 5 |
| 12 | Desafío comunitario semanal (asíncrono) | 3 | 2 | 4 | 2 | 4 | 2 | 2 | **11** | 3, 4 |
| 13 | Anuncios recompensados opcionales | 1 | 0 | 1 | 4 | 3 | 2 | 3 | **4** | 4, 10 |
| 14 | Cosméticos de pago / paquete fundador | 2 | 2 | 1 | 4 | 2 | 3 | 2 | **6** | 4, 10 |
| 15 | Amistades entre mascotas de jugadores | 3 | 3 | 3 | 2 | 2 | 4 | 3 | **6** | base de jugadores |

---

## 5. Propuestas concretas (con números comprobados)

### P1. Ausencia sin castigo [arregla C1]
- **Cambio**: durante la simulación offline, las necesidades tienen **suelos**: hambre ≤ 70, felicidad ≥ 30, higiene ≥ 30, energía libre (duerme). La salud **nunca baja offline**.
- **Comprobación matemática**: los umbrales de daño son hambre > 80, higiene < 20, felicidad < 15 y energía < 5. Con los suelos, ninguno se alcanza offline, así que la salud no baja y **el escape offline es imposible**. En sesión, el jugador está presente y la salud baja tan lento (−15/día con hambre > 80) que se ve venir.
- **Pérdida permanente**: se elimina. Si se mantiene el escape en sesión, la mascota vuelve sola al volver a abrir el juego, con una escena de reencuentro ("te ha echado de menos"). El Collar GPS se retira o se convierte en cosmético.
- **Al volver**: en vez de "Mientras no estabas: −60 felicidad", algo como "Toby te ha estado esperando en la ventana", con una reacción de alegría proporcional al vínculo.
- **Verificar**: test con 4, 24, 72 h y 7 días: salud = 100, sin escape y sin evento `lostForever`.

### P2. Ritmo de vida en días reales [arregla C2]
Separar el **reloj de crecimiento** del **reloj de necesidades**.

| Etapa | Ahora (horas reales) | Propuesta (días reales) |
|---|---|---|
| Bebé | 0-3 h | 0-1 día |
| Cachorro | 3-7 h | 1-3 días |
| Juvenil | 7-14 h | 3-7 días |
| Adulto | 14-45 h | 7-60 días |
| Senior | 45 h+ | 60+ días (sigue pudiendo criar) |

- Necesidades por hora real: hambre +5, felicidad −3, higiene −2,5. Una comida (−35) dura unas 7 h; jugar 2-3 veces al día basta para tenerla bien. Comprobado: de 10 a 75 de hambre son 13 h, así que entrar mañana y noche es suficiente.
- Primera semana: un hito cada 1-4 días, cada uno con algo nuevo que desbloquear, para generar curiosidad. Después, la profundidad viene de la colección, el vínculo y las crías.
- Vitamina: +6 h de crecimiento por 150 🪙, máx. 2 al día. Sin vitaminas, de bebé a adulto son 7 días; usando el máximo (1,5 días de edad por día real) son ~4,7 días y ~9 vitaminas (~1.400 🪙). Acelera, pero no permite saltarse las etapas.
- Cooldown de crianza: 24 h reales.
- **Migración** de partidas: conservar la etapa actual (nadie retrocede), poner la edad en el inicio de su etapa en la nueva escala y versionar el guardado (`SAVE_VERSION`).
- **Verificar**: test de crecimiento por etapas, test de migración desde un JSON v-actual y comparación con los valores anteriores.

### P3. Servidor anti-fraude [arregla C3]
- El precio de adopción se calcula **en el servidor** a partir de los genes, con tope de 220 🪙 (el máximo legítimo del cliente es ~(60+80+0,4·60)·1,2 ≈ 197). Tarifa de pareja limitada a 50-200 🪙.
- Límites por ID: máx. 3 adopciones y 5 usos de pareja al día; tope de ingresos por otros jugadores de 600 🪙/día por dueño.
- Puntajes: máximo uno por competencia cada 10 min por ID, y el ranking muestra solo la puntuación validada (≤ 100, con nota coherente con las estrellas).
- IDs nuevos sin historial no pueden comerciar hasta haber sincronizado durante 24 h (frena las cuentas desechables).
- **Verificar**: casos nuevos en `scripts/test-server.mjs` con precio 5.000, adopción repetida e ID nuevo.

### P4. Guardado robusto [arregla C4]
- Escribir primero `patitas-save-bak` y luego `patitas-save`. Al cargar: si falla el principal, usar el respaldo; si fallan los dos, avisar y ofrecer importar una copia en vez de dejar la pantalla en negro.
- `try/catch` en `boot()` con un mensaje de error útil.
- **Verificar**: tests con JSON truncado y con JSON válido de otra versión.

### P5. Métricas mínimas anónimas
- Eventos al servidor (misma hoja, pestaña `Eventos`): `sesion`, `etapa`, `tutorial_paso`, `minijuego`, `compra_tienda`, `cria`, con ID aleatorio, versión y día. Sin datos personales.
- Actualizar la política de privacidad y Seguridad de los datos ("Interacciones con la aplicación" ya está declarado; hay que añadir "Analíticas" como finalidad).
- Con 20-50 testers da para ver D1/D7 y los embudos. A más escala, pasar a Firebase Analytics o similar.

### P6. Primera sesión guiada
1. Adoptar.
2. "Tiene hambre": arrastrar la comida (con mano animada).
3. "Le gusta que la acaricies": acariciar.
4. Primera foto automática en el álbum.
5. Pantalla breve: "El tiempo pasa aunque cierres el juego; tu mascota estará bien. Mañana será cachorro."
6. Recompensa: lazo o flor gratis, un accesorio visible en el primer minuto.

Usar `tutorialDone`, que ya existe. **Verificar**: embudo de `tutorial_paso` con las métricas de P5.

### P7. Sonido, vibración y celebraciones
- 12-15 efectos cortos: comer, burbujas, caricia (ronroneo/jadeo por especie), salto, monedas, nivel, cámara y fallo; más una música ambiente suave opcional. Libres de derechos (CC0) o sintetizados con WebAudio para no añadir peso.
- `@capacitor/haptics` en caricias, comida, monedas y victoria. Se puede desactivar en Ajustes.
- **Pantallas de hito** para crecer, primera cría, primer concurso ganado y cumpleaños: animación, confeti y foto guardada en el álbum con fecha.

### P8. Vida propia: vínculo, rasgos y conducta contextual
- **Vínculo (0-100) por mascota**: sube con cuidados variados, sin repetir el mismo botón, y no baja por ausencia (C1). Desbloquea gestos:
  - 20: te mira al abrir el juego.
  - 40: viene corriendo hacia ti.
  - 60: hace un truco por su cuenta.
  - 80: trae su juguete favorito.
  - 100: animación de abrazo.
- **2 rasgos por mascota** según los genes: glotón, dormilón, juguetón, tímido, curioso, presumido. Cambian la conducta (el glotón mira el cuenco antes, el tímido se esconde al principio y gana vínculo más despacio, el presumido posa con accesorios) y dan pequeños bonos, no grandes.
- **Conducta en reposo con contexto**: con hambre va al cuenco, sucia se rasca, aburrida trae una pelota, contenta y con vínculo se acerca a la pantalla, de noche se duerme en su cama si la tiene.
- **Preferencias aprendidas**: la comida que más le das se convierte en su favorita y reacciona con más alegría.

### P9. Recuerdos y continuidad
- Cumpleaños (cada 30 días reales) con tarta, foto y título ("1 mes juntos").
- El álbum pasa a ser un diario: primeras veces (primer baño, primer truco, primer amigo en el parque) se guardan solas con frase y fecha.
- Compartir la tarjeta de foto como imagen (Web Share / Capacitor Share): marketing orgánico sin coste.

### P10. Economía con destino (comprobado con los ingresos actuales)
- **Ingresos medidos en el código**: diaria 100-220, misiones ~140 + 40 de bono, minijuegos 120-480 según etapa y competencias. Un activo gana unas 600-800 🪙/día.
- **Decoración de la casa** (sumidero principal): 4 temas de habitación × 5 elementos (papel, suelo, ventana, cama, lámpara) a 200-1.500 🪙, unas 18.000 🪙 en total. Son ~4 semanas de un jugador activo y ~8 de uno casual.
- **Armario**: ampliar de 10 a ~30 accesorios (70-600 🪙) y que los conjuntos completos den un pequeño bono en belleza.
- **Estrellas**: reservarlas para objetos raros y cosméticos animados (5-20 ⭐). Nuevos usos: cambiar el patrón de pelaje de una mascota (15 ⭐) e inscribirse en el concurso semanal (2 ⭐). Ritmo: ~45 ⭐/mes de ingreso y ~120 ⭐ de catálogo, unos 3 meses de metas.
- **Vender a la mitad de precio** lo que sobra en la mochila.
- **Comida de pago útil**: la básica gratis quita hambre pero no da felicidad; las favoritas por especie dan vínculo.
- **Verificar**: simulador de economía (como `npm run simular` de Zoo) que reproduzca 30 días de un jugador casual y uno activo.

### P11. Colección genética (largo plazo)
- Variantes raras: patrón "estrellas" o "galaxia", ojos de color distinto y pelaje albino, con 1-5 % por cría y más probabilidad si los padres tienen rasgos raros.
- **Libro de pelajes** por especie (colores × patrones) con huecos por descubrir: es la meta de los veteranos.
- Título de criador según las variantes descubiertas, visible en el parque y en las adopciones.

### P12. Social ligero (para pocos jugadores)
- **Desafío comunitario semanal** en la hoja: "Entre todos, 500 baños esta semana"; si se cumple, todos reciben un regalo. Es asíncrono y funciona con 20 jugadores.
- En el parque, **dejar un regalo** (una golosina) a la mascota de otro: le llega con tu apodo.
- Amistades, visitas a casas y chat: **no** hasta que haya base de jugadores y moderación.

---

## 6. Monetización (hipótesis, sin cifras inventadas)

**Principios**: el juego completo es gratis; nada de pay-to-win; ninguna frustración artificial para vender; nunca vender la solución al castigo (que se elimina en P1).

| Opción | Valor para el jugador | Aceptación [H] | Retención | Coste | Riesgo | Veredicto |
|---|---|---|---|---|---|---|
| Anuncio recompensado opcional (p. ej. duplicar el premio de un minijuego, 1 vez/día) | Medio | Media-alta en juegos casual | Neutra si es opcional | Bajo: Zoo ya usa AdMob | Exige cambiar las declaraciones de Play | Experimento tras P5 y P10 |
| Paquete fundador (único: set cosmético exclusivo + insignia de apoyo) | Alto para fans | Baja en volumen, alta en los comprometidos | Positiva | Bajo-medio: Zoo ya usa native-purchases | Bajo | **Primer experimento de pago** |
| Packs cosméticos (temas de casa, conjuntos) | Medio | Media | Neutra | Medio (arte) | Bajo | Tras la decoración (P10) |
| Paquetes de monedas | Bajo (las monedas sobran) | Baja | Riesgo pay-to-skip | Bajo | Medio | No por ahora |
| Pase de temporada | Medio | Requiere retención probada | Positiva si hay contenido | Alto | Alto | No hasta tener D30 |
| Suscripción | Bajo ahora | Baja | — | Alto | Alto | No |

**Ingresos**: dependen de jugadores activos × tasa de conversión × precio. Hoy no hay ningún dato para estimarlos, y sería inventar. Con anuncios: ingresos ≈ usuarios activos × anuncios vistos por usuario × eCPM / 1000.

**Experimentos de bajo coste, en este orden**:
1. Con las métricas de P5, medir D1, D7 y sesiones por día antes de cobrar nada.
2. Encuesta dentro del juego tras 7 días de uso: "¿Comprarías un paquete de apoyo con X?".
3. Paquete fundador en prueba cerrada con testers con licencia de prueba.
4. Si hay base suficiente, anuncio recompensado opcional, midiendo la tasa de aceptación y que D7 no baje.

**Requisitos de Google Play comprobados (octubre 2026)**:
- Desde el 31-ago-2026 las apps nuevas y las actualizaciones deben usar **Play Billing Library 8 o superior** (prórroga hasta el 1-nov-2026). Hay que comprobar la versión que incluye el plugin de compras de Zoo antes de reutilizarlo.
- Comisión: 15 % hasta el primer millón al año. En EE. UU., Reino Unido y el EEE, desde el 30-jun-2026: 10 % + 5 % de facturación, igual de efectivo.
- Añadir anuncios obliga a cambiar la declaración de **Anuncios** (etiqueta "Contiene anuncios"), el **ID de publicidad**, la **Seguridad de los datos** y la política de privacidad. Con público 13+ no aplica el programa Familias.

Fuentes: [Billing Library 8 — fecha límite](https://dev.to/mr_manushukla/play-billing-library-8-by-31-august-2026-every-removed-api-and-the-migration-path-58pn) · [Actualizar antes del 31 de agosto](https://www.appsonair.com/blogs/how-to-update-google-play-billing-library-before-the-august-31-deadline) · [Comisiones de Google Play (Ayuda)](https://support.google.com/googleplay/android-developer/answer/112622?hl=en) · [Cambios de comisiones 2026](https://adapty.io/blog/markdown/google-play-billing-changes-subscriptions-fees.md)

**Costes de operación**: Google Sheets + Apps Script cuesta 0 €, pero tiene cuotas y un candado global. Vale para decenas de jugadores simultáneos [H]. Hay que migrar a Firebase o Supabase antes de cualquier campaña de captación (el cambio queda en `OnlineService.ts`).

---

## 7. Plan de implementación por etapas

Cada etapa conserva lo que funciona, versiona el guardado si toca datos, añade tests, se valida con `npm run -s revisar` y se compara antes y después con simulación. **Nada se implementa sin tu aprobación de la etapa.**

| Etapa | Contenido | Sistemas | Cómo se comprueba | Esfuerzo [H] |
|---|---|---|---|---|
| **0. Urgente** | P1 sin castigo, P4 guardado robusto, P3 anti-fraude | `Pet.simulateDecay`, `PetManager` (escape), `SaveSystem`, `main.ts`, Apps Script | Tests de ausencia (4 h-7 días), de JSON corrupto y del servidor; nueva versión del Apps Script | 1-2 días |
| **1. Medir** | P5 métricas + política y declaración en Play | `OnlineService`, Apps Script, `privacidad.html`, Play Console | Eventos visibles en la hoja con los testers | 1 día |
| **2. Ritmo y primera impresión** | P2 nuevo ritmo con migración, P6 tutorial, P7 sonido/vibración/celebraciones | `GameConfig`, `GrowthSystem`, `stages`, `SaveSystem.migrate`, UI | Tests de crecimiento y migración; embudo del tutorial; prueba en el móvil | 4-6 días |
| **3. Vida y apego** | P8 vínculo/rasgos/conducta, P9 recuerdos y cumpleaños | `Pet` (datos nuevos), `HomeScreen.idleBehavior`, `AlbumSystem`, sprites | Tests de vínculo; revisión visual con capturas `shot` | 5-8 días |
| **4. Profundidad** | P10 economía + decoración, P11 colección genética | `items`, `EconomySystem`, `BreedingSystem`, pantalla nueva | Simulador de economía a 30 días (casual y activo) | 6-10 días |
| **5. Comunidad y validación comercial** | P12 desafío semanal; experimentos de monetización (sección 6) | Apps Script, UI | D7 antes y después; tasa de aceptación | Según los datos |

**Recomendación**: aprobar ya la **Etapa 0** (riesgo bajo, impacto máximo, no cambia el diseño) y la **Etapa 1**. Antes de la Etapa 2, decidir contigo el nuevo ritmo de vida, porque cambia la sensación del juego para los testers actuales.

---

## Estado de la implementación

- **Etapa 0 (14-oct-2026) — hecha.** P1: `GameConfig.OFFLINE_LIMITS` + salud sin daño offline + la escapada vuelve sola a las 48 h (evento `pet:returnedHome`). P4: copia `mascota_virtual_save_bak`, carga con respaldo y aviso; si todo falla, se guarda `mascota_virtual_save_danada` y se puede jugar. P3: Apps Script v2 con topes (precio ≤ 220, tarifa 50-200, ingresos ≤ 600/día, 3 adopciones y 5 parejas al día, 1 puntaje cada 10 min, hay que haber sincronizado). Tests: 9 nuevos en `tests/systems.test.ts` y 9 casos nuevos en `scripts/test-server.mjs`.
- **Etapa 1 — hecha.** P5: `Analytics.ts` (sesión, adopción inicial, etapa, minijuego, competencia, compra, cría, escape), enviados dentro de `sincronizar` (sin peticiones extra), pestaña `Eventos`, `?accion=metricas` solo con números agregados, interruptor en Ajustes, política de privacidad actualizada. Resumen: `npm run -s metricas`.
- **Etapa 2 — hecha.** P2 (ritmo en días reales + migración v1→v2), P6 tutorial, P7 sonido/vibración/celebraciones.
- **Etapa 3 — hecha.** P8 vínculo, 7 rasgos, conducta con contexto; P9 primeras veces, comida favorita, cumpleaños, saludo al volver.
- **Etapa 4 — hecha.** P10 decoración (~11.000 🪙 + 40 ⭐), venta a mitad de precio, simulador `npm run economia` (activo ~880 🪙/día: 15 días para comprarlo todo; casual 41). P11 colores raros (3 % / 8 %), libro de pelajes (42), título de criador, +5 ⭐ por especie. Pendiente: ampliar accesorios (requiere arte).
- **Etapa 5 — hecha.** P12 desafío semanal (Apps Script v3, pestaña Comunidad) y golosinas en el parque (3/día). Monetización: solo la encuesta de apoyo (sección 6, experimento 2); los pagos se deciden con las métricas.
