/**
 * Fondo de la casa: una habitación acogedora dibujada en SVG.
 * Tiene versión de día y de noche (cuando la mascota duerme: ventana con
 * luna y estrellas, luz tenue y la lámpara encendida).
 *
 * El viewBox es 400×700 y se escala con "xMidYMax slice", así el suelo y la
 * alfombra quedan siempre abajo, sea cual sea la forma de la pantalla.
 */

export function renderRoomSVG(night: boolean): string {
  const sky = night
    ? `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f2a55"/><stop offset="1" stop-color="#46508a"/></linearGradient>`
    : `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc8ff"/><stop offset="1" stop-color="#d6f0ff"/></linearGradient>`;
  const skyContent = night
    ? `<circle cx="318" cy="150" r="16" fill="#fff6c9"/><circle cx="324" cy="145" r="14" fill="#2c3768"/>` +
      [[262, 130], [300, 190], [340, 210], [275, 220], [345, 128]]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#fff"/>`)
        .join('')
    : `<circle cx="326" cy="146" r="17" fill="#ffd54a"/><circle cx="326" cy="146" r="25" fill="#ffd54a" opacity="0.25"/>` +
      `<g fill="#fff" opacity="0.95"><ellipse cx="272" cy="190" rx="20" ry="9"/><ellipse cx="288" cy="184" rx="14" ry="10"/><ellipse cx="340" cy="214" rx="16" ry="7"/></g>` +
      `<path d="M240 262 Q270 236 300 252 Q330 238 368 258 L368 262 Z" fill="#8fd17a"/>`;

  return `
<svg class="room-svg" viewBox="0 0 400 700" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    ${sky}
    <pattern id="wallpaper" width="40" height="40" patternUnits="userSpaceOnUse">
      <rect width="40" height="40" fill="#ffe7cc"/>
      <rect width="20" height="40" fill="#ffdfbf"/>
      <circle cx="10" cy="10" r="2.6" fill="#ffc69a"/><circle cx="30" cy="30" r="2.6" fill="#ffb8b8"/>
    </pattern>
    <pattern id="planks" width="120" height="44" patternUnits="userSpaceOnUse">
      <rect width="120" height="44" fill="#d9a066"/>
      <rect y="0" width="120" height="22" fill="#d39858"/>
      <path d="M0 22 H120 M0 44 H120" stroke="#b97c43" stroke-width="2"/>
      <path d="M40 0 V22 M100 22 V44" stroke="#b97c43" stroke-width="2"/>
    </pattern>
    <radialGradient id="glow"><stop offset="0" stop-color="#ffe9a8" stop-opacity="0.9"/><stop offset="1" stop-color="#ffe9a8" stop-opacity="0"/></radialGradient>
  </defs>

  <!-- Pared con papel pintado -->
  <rect width="400" height="480" fill="url(#wallpaper)"/>
  <rect y="0" width="400" height="14" fill="#f3c79c"/>

  <!-- Ventana con cortinas -->
  <rect x="236" y="104" width="140" height="166" rx="10" fill="#fff" stroke="#c98a5a" stroke-width="4"/>
  <rect x="246" y="114" width="120" height="146" rx="4" fill="url(#sky)"/>
  ${skyContent}
  <path d="M306 114 V260 M246 187 H366" stroke="#fff" stroke-width="6"/>
  <rect x="226" y="270" width="160" height="10" rx="4" fill="#c98a5a"/>
  <path d="M232 96 Q246 180 240 286 L222 286 Q226 180 222 96 Z" fill="#ff8fa3"/>
  <path d="M380 96 Q366 180 372 286 L390 286 Q386 180 390 96 Z" fill="#ff8fa3"/>
  <rect x="216" y="90" width="180" height="10" rx="5" fill="#a86a3c"/>

  <!-- Cuadro con huella -->
  <rect x="42" y="118" width="96" height="76" rx="6" fill="#fff8ee" stroke="#b97c43" stroke-width="6"/>
  <g fill="#ff9b4d"><ellipse cx="90" cy="164" rx="14" ry="11"/><circle cx="72" cy="146" r="6"/><circle cx="84" cy="138" r="6"/><circle cx="97" cy="138" r="6"/><circle cx="108" cy="146" r="6"/></g>

  <!-- Estantería con libros y planta -->
  <rect x="30" y="290" width="150" height="10" rx="3" fill="#a86a3c"/>
  <rect x="44" y="246" width="14" height="44" fill="#6bb8ff"/><rect x="60" y="252" width="12" height="38" fill="#ffd54a"/>
  <rect x="74" y="242" width="16" height="48" fill="#8bd17c"/><rect x="92" y="256" width="12" height="34" transform="rotate(12 98 273)" fill="#ff8fa3"/>
  <path d="M136 290 L140 262 L164 262 L168 290 Z" fill="#e2704a"/>
  <path d="M152 262 Q138 236 146 222 Q154 240 152 262 Q156 232 172 226 Q168 248 152 262" fill="#5cb85c"/>

  <!-- Zócalo y suelo de madera -->
  <rect y="470" width="400" height="14" fill="#f0b98a"/>
  <rect y="484" width="400" height="216" fill="url(#planks)"/>

  <!-- Lámpara de pie -->
  ${night ? '<circle cx="358" cy="420" r="90" fill="url(#glow)"/>' : ''}
  <rect x="354" y="400" width="6" height="150" fill="#7a5a3a"/>
  <ellipse cx="357" cy="552" rx="22" ry="6" fill="#7a5a3a"/>
  <path d="M332 404 L382 404 L372 366 L342 366 Z" fill="${night ? '#ffe28a' : '#ffd1a8'}" stroke="#c98a5a" stroke-width="3"/>

  <!-- Alfombra redonda donde está la mascota -->
  <ellipse cx="200" cy="604" rx="160" ry="44" fill="#ff9f9f"/>
  <ellipse cx="200" cy="604" rx="132" ry="34" fill="none" stroke="#ffe0d6" stroke-width="6" stroke-dasharray="14 10"/>
  <ellipse cx="200" cy="604" rx="96" ry="22" fill="#ffb7b0"/>

  ${night ? '<rect width="400" height="700" fill="#141c3c" opacity="0.32"/>' : ''}
</svg>`;
}
