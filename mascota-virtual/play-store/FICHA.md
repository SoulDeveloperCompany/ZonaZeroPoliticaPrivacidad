# Patitas en Google Play — ficha y declaraciones

Cuenta de desarrollador: **Soul Hope** (personal, alex.san.otaku@gmail.com). App nueva, independiente de Mi Zoológico.
Paquete: `com.souldevelopercompany.patitas`. Idioma predeterminado: Español (Latinoamérica) – es-419.

## Ficha de Play Store

- **Nombre (≤30):** Patitas
- **Descripción breve (≤80):** Adopta una mascota, cuídala desde bebé, juega con ella y compite con otros.
- **Descripción completa:**

```
¡Adopta tu mascota virtual y cuídala desde que es un bebé! 🐾

Elige entre perro, gato, conejo, loro, tortuga o hámster, ponle nombre y acompáñala mientras crece: bebé, cachorro, juvenil, adulto y senior. Cada mascota es única: su color, su patrón y su tamaño se heredan de sus padres.

🍖 CUÍDALA DE VERDAD
Dale de comer arrastrando la comida, báñala con jabón y agua, acaríciala tocando la pantalla y deja que duerma cuando esté cansada. Si la descuidas mucho, ¡puede escaparse de casa y tendrás que buscarla!

🎾 JUEGA Y ENTRENA
Seis minijuegos que se desbloquean según la etapa: revienta burbujas, encuentra la pelota, atrapa golosinas, memoria, saltos y ensayo de trucos. Entrénala y sácala a pasear para mejorar sus habilidades.

🏆 COMPITE
Cuando sea adulta, inscríbela en carreras de agilidad, concursos de belleza y shows de trucos. Sube en el ranking global y gana monedas y estrellas.

🐣 FAMILIA Y CRÍAS
Cruza a tus mascotas adultas, ten crías que heredan sus rasgos y lleva a las que no quepan en casa al rancho. También puedes dar crías en adopción a otros jugadores.

🌳 PARQUE EN LÍNEA
Visita el parque y saluda a las mascotas de otros jugadores que están conectados.

🛍️ TIENDA Y MISIONES
Compra comida, accesorios que se ven puestos, muebles para la casa y medicinas con las monedas que ganas jugando. Completa las misiones diarias y recoge tu recompensa cada día.

📸 ÁLBUM DE RECUERDOS
Guarda los momentos especiales de tu mascota: su primer día, cuando creció, sus premios…

Sin anuncios y sin compras con dinero real: todas las monedas se ganan jugando.
```

- **Icono:** `icono-512.png` · **Gráfico de funciones:** `grafico-1024x500.png`
- **Capturas de teléfono (1080×1920):** `capturas/01-casa.png` … `capturas/06-jugar.png`

## Configuración de la tienda

- Tipo: Juego · Categoría: Simulación · Etiquetas: Mascotas virtuales / Casual (según las que ofrezca Play)
- Correo de contacto: souldevelopercompany@gmail.com
- Política de privacidad: https://souldevelopercompany.github.io/ZonaZeroPoliticaPrivacidad/privacidad.html
  (fuente: `public-pages/privacidad.html`, se publica con `bash scripts/deploy-pages.sh`)

## Contenido de la aplicación (declaraciones)

| Declaración | Respuesta |
|---|---|
| Política de privacidad | URL de arriba |
| Acceso a la aplicación | Todas las funciones están disponibles sin restricciones (no hay inicio de sesión) |
| Anuncios | No contiene anuncios |
| Clasificación del contenido | Categoría "Juego". Sin violencia, sexo, lenguaje soez, drogas, juegos de apuestas ni miedo. Los usuarios **sí interactúan** (ven el apodo, el nombre de la mascota y los puntajes de otros), no se comparte ubicación, no hay compras digitales. |
| Público objetivo | 13-15, 16-17 y 18+ (igual que Mi Zoológico; fuera del programa Familias). No atrae involuntariamente a niños: sí puede, por eso se deja fuera <13 y la política lo dice |
| Seguridad de los datos | Recoge datos: Sí. Cifrados en tránsito: Sí. Eliminación: se puede pedir por correo. Tipos: **Información personal › ID de usuario** (ID aleatorio del jugador) · **Actividad en la app › Interacciones en la app** (puntajes, adopciones, parejas) · **Actividad en la app › Otro contenido generado por usuarios** (nombre y aspecto de la mascota). Todos: recogidos, no compartidos, no efímeros, obligatorios, finalidad "Funciones de la aplicación". |
| ID de publicidad | No usa ID de publicidad |
| Apps gubernamentales | No |
| Funciones financieras | Ninguna |
| Aplicaciones de salud | Ninguna |
| Precio | Gratis |

## Estado en Play Console (5 oct 2026)

App creada (ID 4971985063553773767). Hecho: ficha (textos, icono, gráfico, 6 capturas), configuración de la tienda,
y todas las declaraciones de "Contenido de la aplicación". Clasificación IARC: PEGI 3 / ESRB Para todos, con "Interacción de usuarios".
En el cuestionario se respondió **Sí** a interacción entre usuarios (nombre de mascota visible) y **No** a bloquear/denunciar/moderación.
URL de eliminación de datos: .../privacidad.html#eliminar-datos

## Pendiente para publicar

1. Quitar "🧪 Herramientas de prueba" de Ajustes antes de la versión de tienda.
2. Generar el **AAB firmado** (keystore propia) y subirlo a **Prueba cerrada**.
   Las cuentas personales nuevas necesitan una prueba cerrada con **al menos 12 testers durante 14 días**
   antes de poder pedir acceso a Producción.
