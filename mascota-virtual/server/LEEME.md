# Servidor de Patitas con Google Sheets

Mientras no haya un servidor "de verdad", el multijugador funciona con una hoja de
Google y un Apps Script (igual que el ranking de Mi Zoológico). Es gratis.

## Qué guarda

| Pestaña | Para qué |
|---|---|
| `Jugadores` | Quién juega, su mascota principal (para el parque) y las monedas que le deben otros jugadores |
| `Adopciones` | Crías publicadas en adopción y quién las adoptó |
| `Parejas` | Mascotas adultas ofrecidas para tener crías (con su tarifa) |
| `Puntajes` | Mejor puntaje de cada jugador en cada competencia (ranking global) |

Las pestañas se crean solas la primera vez que el juego se conecta.

## Instalación (5 minutos)

1. Crea una hoja nueva en Google Sheets (por ejemplo "Patitas servidor").
2. Menú **Extensiones › Apps Script**. Borra el código que aparece y pega todo el contenido de
   [`patitas-apps-script.js`](patitas-apps-script.js). Guarda (💾).
3. **Implementar › Nueva implementación** → tipo **Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
4. Autoriza los permisos que pide Google (es tu propia hoja).
5. Copia la **URL de la aplicación web** (termina en `/exec`).
6. En el juego: **⚙️ Ajustes › 🌐 Servidor**, pega la URL y toca **Conectar**.
   Para que venga puesta de serie en el APK, pégala en `src/core/OnlineConfig.ts`.

Si cambias el script más adelante: **Implementar › Gestionar implementaciones › ✏️ › Versión: nueva**
(así la URL no cambia).

## Cómo funciona

- Cada jugador tiene un id aleatorio y un apodo automático (p. ej. "Patita Feliz 123"), como en Mi Zoológico.
- El juego se sincroniza al abrirse y cada 3 minutos: envía su mascota principal (aparece en el
  parque de los demás durante 30 minutos) y recibe las monedas que otros le pagaron.
- **Adopción:** al publicar una cría se sube a `Adopciones`. Cuando otro jugador la adopta,
  paga el precio y el dueño lo recibe en su siguiente sincronización (la cría se va de su partida).
- **Parejas:** puedes ofrecer un adulto como pareja; quien lo usa paga la tarifa y tú la cobras.
- **Competencias:** se guarda tu mejor puntaje y se muestra el ranking global.

## Limitaciones (es una solución provisional)

- Apps Script tarda 1-3 segundos por petición y tiene cuotas diarias: vale para pruebas y pocas
  decenas de jugadores, no para miles.
- Cualquiera que conozca la URL podría enviar datos: no guardes nada sensible.
  Para producción conviene migrar a Firebase o Supabase (la app solo habla con
  `src/systems/online/OnlineService.ts`, así que el cambio queda en un único archivo).
- La versión que se publica como artefacto de Claude no puede conectarse a servidores externos
  (lo bloquea el visor); el multijugador funciona en el APK y en el navegador normal.
