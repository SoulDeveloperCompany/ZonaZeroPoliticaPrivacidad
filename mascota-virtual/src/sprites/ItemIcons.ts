/**
 * Iconos SVG de objetos (comida, salud, crecimiento, especiales), de los objetos de los minijuegos
 * y de los propios juegos. Mismo estilo "pegatina" que mascotas, muebles e iconos de la interfaz:
 * sustituyen a los emojis, que cambian según el móvil (auditoría de diseño 2026-10).
 * viewBox 0 0 32 32.
 */
const K = '#3a2a20';
const svg = (body: string): string =>
  `<svg class="obj-icon" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="${K}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;
const dots = (pts: [number, number][], fill: string, r = 0.9) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="none"/>`).join('');
const BONE = '<path d="M9 13.5 a3 3 0 1 1 2.6 -4.4 L20.4 17.9 a3 3 0 1 1 4.4 2.6 a3 3 0 1 1 -2.6 4.4 L13.4 16.1 a3 3 0 1 1 -4.4 -2.6 Z" fill="#fff"/>';

const ICONS: Record<string, string> = {
  // ---------- Comida ----------
  food_basic: svg(
    '<path d="M7 15 C8 10 24 10 25 15" fill="#c47a3f"/>' + dots([[12, 12.6], [16, 11.4], [20, 12.8]], '#8a5428', 1.1) +
      '<path d="M4 15 H28 A12 10 0 0 1 4 15 Z" fill="#6bb8ff"/><path d="M9 19 H23" stroke="#c9ecff" stroke-width="1.8"/>',
  ),
  food_kibble: svg('<circle cx="16" cy="16" r="11" fill="#e0a868"/>' + dots([[12, 12], [19, 11], [21, 18], [13, 20], [17, 16]], '#6b3f1d', 1.5) + '<path d="M9 11 a8 8 0 0 1 4 -3.5" stroke="#f5d2a3" stroke-width="1.6"/>'),
  food_meat: svg(
    '<path d="M19 19 L24.5 24.5" stroke-width="5"/><path d="M19 19 L24.5 24.5" stroke="#fff" stroke-width="2.6"/>' +
      '<circle cx="26.5" cy="23.5" r="2.4" fill="#fff"/><circle cx="23.5" cy="26.5" r="2.4" fill="#fff"/>' +
      '<path d="M5 13 C4 6 11 3 16 5 C22 7 24 13 21 18 C18 22 12 23 8 20 C6 18.5 5.3 16 5 13 Z" fill="#c8553d"/>' +
      '<path d="M8 10 C10 7 14 6.5 16.5 8" stroke="#e98a6b" stroke-width="1.8"/><path d="M9 15 C12 17 15 17 17 15" stroke="#8a3424" stroke-width="1.3"/>',
  ),
  food_bone: svg(BONE),
  food_fish: svg(
    '<path d="M22 16 L29 10 L28 16 L29 22 Z" fill="#4a9be8"/>' +
      '<path d="M3.5 16 C7 9 17 8 23 16 C17 24 7 23 3.5 16 Z" fill="#6bb8ff"/>' +
      '<path d="M14 11 C16 14 16 18 14 21" stroke="#c9ecff" stroke-width="1.4"/><circle cx="8.5" cy="14.8" r="1.3" fill="' + K + '" stroke="none"/>',
  ),
  food_milk: svg(
    '<path d="M13 7 C13 3.5 19 3.5 19 7" fill="#ffb3c7"/><rect x="11.5" y="7" width="9" height="3.5" rx="1" fill="#6bb8ff"/>' +
      '<rect x="10" y="10.5" width="12" height="18" rx="3.5" fill="#fff"/><path d="M10 17 H22 V25 a3.5 3.5 0 0 1 -3.5 3.5 H13.5 A3.5 3.5 0 0 1 10 25 Z" fill="#fff4e0" stroke="none"/>' +
      '<rect x="10" y="10.5" width="12" height="18" rx="3.5"/><path d="M13 14 H15 M13 20 H15" stroke-width="1.3"/>',
  ),
  food_carrot: svg(
    '<path d="M18 9 C17 5 19 3 21 3 M19 9 C21 6 24 6 26 7 M20 10 C23 9 26 11 27 13" stroke="#3f8a3e" stroke-width="2.2"/>' +
      '<path d="M8 27 C6 25 9 17 15 11 C17 9 21 10 22 12 C23 14 21 17 19 19 C13 25 10 29 8 27 Z" fill="#ff8a3d"/>' +
      '<path d="M13 18 L15 19 M11 22 L13 23 M16 14 L18 15" stroke="#c4520f" stroke-width="1.3"/>',
  ),
  food_lettuce: svg(
    '<circle cx="11" cy="18" r="7" fill="#7fd27c"/><circle cx="21" cy="18" r="7" fill="#7fd27c"/><circle cx="16" cy="12" r="7.5" fill="#a6e39a"/>' +
      '<g stroke="none"><circle cx="11" cy="18" r="7" fill="#7fd27c"/><circle cx="21" cy="18" r="7" fill="#7fd27c"/><circle cx="16" cy="12" r="7.5" fill="#a6e39a"/></g>' +
      '<path d="M16 26 V12 M16 18 L12 15 M16 16 L20 13" stroke="#5bb35a" stroke-width="1.4"/>',
  ),
  food_seeds: svg(
    Array.from({ length: 10 }, (_, i) => `<ellipse cx="16" cy="6.5" rx="3" ry="5" fill="#ffd23f" transform="rotate(${i * 36} 16 16)"/>`).join('') +
      '<circle cx="16" cy="16" r="6.5" fill="#8a5428"/>' + dots([[14, 14], [18, 14], [16, 17], [13.5, 18], [18.5, 18]], '#5a3416', 0.9),
  ),
  food_fruit: svg(
    '<path d="M16 28 C7 22 5 14 9 10 C11.5 8 14 9 16 10.5 C18 9 20.5 8 23 10 C27 14 25 22 16 28 Z" fill="#ff5a6e"/>' +
      '<path d="M11 8.5 L16 11 L21 8.5 L18 6.5 L16 4 L14 6.5 Z" fill="#5bb35a"/>' + dots([[12, 15], [16, 14.5], [20, 15], [14, 19], [18, 19], [16, 23]], '#ffe08a', 0.8),
  ),
  food_cake: svg(
    '<path d="M7 17 H25 L22.5 28 H9.5 Z" fill="#ff8fb5"/><path d="M12 17 L12.8 28 M16 17 V28 M20 17 L19.2 28" stroke="#e5709a" stroke-width="1.3"/>' +
      '<path d="M6 17 C5 13 9 11 11 11.5 C12 8 20 8 21 11.5 C23 11 27 13 26 17 Z" fill="#fff"/><circle cx="16" cy="7" r="2.6" fill="#e83b4c"/><path d="M16 4.5 C17 3 18.5 2.5 19.5 3" stroke-width="1.2"/>' +
      dots([[11, 14], [15, 13], [19.5, 14.5], [22, 15.5]], '#ff8fb5', 0.8),
  ),
  // ---------- Crecimiento, salud y especiales ----------
  acc_growth_vitamin: svg('<g transform="rotate(-40 16 16)"><rect x="5" y="11" width="22" height="10" rx="5" fill="#fff"/><path d="M16 11 H22 a5 5 0 0 1 0 10 H16 Z" fill="#ff8a3d"/><rect x="5" y="11" width="22" height="10" rx="5"/><path d="M9 14 H12" stroke="#fff" stroke-width="1.6"/></g>'),
  acc_growth_clock: svg(
    '<rect x="7" y="3.5" width="18" height="3" rx="1.2" fill="#c47a3f"/><rect x="7" y="25.5" width="18" height="3" rx="1.2" fill="#c47a3f"/>' +
      '<path d="M9.5 6.5 C9.5 12 15 13 15 16 C15 19 9.5 20 9.5 25.5 H22.5 C22.5 20 17 19 17 16 C17 13 22.5 12 22.5 6.5 Z" fill="#d9f2ff"/>' +
      '<path d="M12 24.5 C12 21.5 16 20.5 16 19 C16 20.5 20 21.5 20 24.5 Z M12.5 9 H19.5 C18.5 12 16.5 13 16 14 C15.5 13 13.5 12 12.5 9 Z" fill="#ffd23f" stroke="none"/>',
  ),
  med_syrup: svg(
    '<rect x="12" y="3.5" width="8" height="4" rx="1.2" fill="#fff"/><path d="M11 7.5 H21 V10 C24 12 25 14 25 17 V25 a3.5 3.5 0 0 1 -3.5 3.5 H10.5 A3.5 3.5 0 0 1 7 25 V17 C7 14 8 12 11 10 Z" fill="#ff8fb5"/>' +
      '<rect x="10.5" y="15.5" width="11" height="9" rx="2" fill="#fff"/><path d="M16 17.5 V22.5 M13.5 20 H18.5" stroke="#e83b4c" stroke-width="2"/>',
  ),
  med_kit: svg(
    '<path d="M12 8 V6 a2 2 0 0 1 2 -2 H18 a2 2 0 0 1 2 2 V8"/><rect x="4" y="8" width="24" height="19" rx="4" fill="#fff"/>' +
      '<path d="M13 12.5 H19 V15.5 H22 V21.5 H19 V24.5 H13 V21.5 H10 V15.5 H13 Z" fill="#e83b4c" stroke-width="1.3"/>',
  ),
  med_soap: svg(
    '<path d="M15 9 V5.5 H21 M21 5.5 V7.5" stroke-width="1.8"/><rect x="12.5" y="9" width="7" height="3.5" rx="1" fill="#fff"/>' +
      '<path d="M10 12.5 H22 C24 12.5 25 14 25 16 V26 a2.5 2.5 0 0 1 -2.5 2.5 H9.5 A2.5 2.5 0 0 1 7 26 V16 C7 14 8 12.5 10 12.5 Z" fill="#6bb8ff"/>' +
      '<path d="M16 17 C18 19 18 22 16 23 C14 22 14 19 16 17 Z" fill="#fff" stroke-width="1.2"/><circle cx="26" cy="9" r="2.4" fill="#d9f2ff"/><circle cx="28" cy="4.5" r="1.5" fill="#d9f2ff"/>',
  ),
  special_gps: svg(
    '<ellipse cx="16" cy="13" rx="11" ry="5" fill="none" stroke="' + K + '" stroke-width="4.4"/><ellipse cx="16" cy="13" rx="11" ry="5" fill="none" stroke="#e83b4c" stroke-width="2.4"/>' +
      '<circle cx="16" cy="22" r="5" fill="#ffd23f"/><circle cx="16" cy="22" r="1.4" fill="' + K + '" stroke="none"/>' +
      '<path d="M23 21 a5 5 0 0 1 0 4 M26 19.5 a8 8 0 0 1 0 7" stroke="#6bb8ff" stroke-width="1.8"/>',
  ),
  // ---------- Objetos de minijuegos ----------
  mg_broccoli: svg(
    '<path d="M14 18 L13 28 H19 L18 18 Z" fill="#a6e39a"/><circle cx="10" cy="14" r="5" fill="#3f8a3e"/><circle cx="22" cy="14" r="5" fill="#3f8a3e"/><circle cx="16" cy="10" r="6" fill="#4f9e4c"/>' +
      '<g stroke="none"><circle cx="10" cy="14" r="5" fill="#3f8a3e"/><circle cx="22" cy="14" r="5" fill="#3f8a3e"/><circle cx="16" cy="10" r="6" fill="#4f9e4c"/></g>',
  ),
  mg_chili: svg('<path d="M21 9 C23 6 25 5 27 5" stroke="#3f8a3e" stroke-width="2.4"/><path d="M19 8 C24 9 24 14 20 19 C16 24 10 27 5 27 C9 24 13 20 15 15 C16 11 16 8 19 8 Z" fill="#e83b4c"/><path d="M17 11 C18 13 17 16 15 18" stroke="#ff9a9a" stroke-width="1.5"/>'),
  mg_log: svg('<rect x="4" y="12" width="22" height="12" rx="3" fill="#a8693a"/><path d="M8 15 H18 M10 20 H20" stroke="#7a4a24" stroke-width="1.3"/><ellipse cx="25" cy="18" rx="4" ry="6" fill="#e0b07a"/><ellipse cx="25" cy="18" rx="1.8" ry="3" fill="none" stroke="#a8693a" stroke-width="1.2"/>'),
  mg_rock: svg('<path d="M4 26 L7 15 L13 9 L21 10 L27 17 L28 26 Z" fill="#a9a9b8"/><path d="M13 9 L15 16 L27 17 M15 16 L10 26" stroke="#7d7d8f" stroke-width="1.3"/><path d="M9 16 L12 12" stroke="#d6d6e0" stroke-width="1.6"/>'),
  mg_cactus: svg(
    '<path d="M13 28 V8 a3 3 0 0 1 6 0 V28 Z" fill="#5bb35a"/><path d="M13 19 H9 a2.5 2.5 0 0 1 -2.5 -2.5 V12 a2 2 0 0 1 4 0 V15 H13" fill="#5bb35a"/>' +
      '<path d="M19 16 H22 V10 a2 2 0 0 1 4 0 V15.5 a3.5 3.5 0 0 1 -3.5 3.5 H19" fill="#5bb35a"/><path d="M16 11 V25" stroke="#3f8a3e" stroke-width="1.2"/><circle cx="16" cy="5" r="1.8" fill="#ff8fb5"/>',
  ),
  mg_cone: svg('<path d="M16 4 L25 26 H7 Z" fill="#ff8a3d"/><path d="M12.3 13 H19.7 L21 16.5 H11 Z M9.9 19 H22.1 L23.4 22 H8.6 Z" fill="#fff" stroke="none"/><rect x="4" y="26" width="24" height="3.5" rx="1.2" fill="#c4520f"/>'),
  mg_cup: svg('<path d="M6 8 H26 L22.5 29 H9.5 Z" fill="#ff6b6b"/><path d="M7.5 15 H24.5" stroke="#fff" stroke-width="2.2"/><path d="M8.6 21 H23.4" stroke="#fff" stroke-width="2.2"/><rect x="4.5" y="5" width="23" height="4.5" rx="1.6" fill="#ff8f8f"/><path d="M9 6.5 H13" stroke="#fff" stroke-width="1.4"/>'),
  // ---------- Juegos y competencias ----------
  game_bubbles: svg('<circle cx="12.5" cy="18.5" r="8" fill="#bfe8ff"/><circle cx="23" cy="10" r="5" fill="#ffd1e8"/><circle cx="24.5" cy="23.5" r="3.3" fill="#e8d4ff"/><path d="M8 15.5 a5 5 0 0 1 3.5 -3.2" stroke="#fff" stroke-width="2"/>'),
  game_cups: svg('<path d="M7 9 H25 L22 27 H10 Z" fill="#ff6b6b"/><path d="M8.5 15 H23.5" stroke="#fff" stroke-width="2"/><rect x="5.5" y="6" width="21" height="4" rx="1.5" fill="#ff8f8f"/><circle cx="27" cy="27" r="3" fill="#ffd23f"/>'),
  game_catch: svg('<path d="M6 12 L2.5 9 L3 15 L6 13 M26 12 L29.5 9 L29 15 L26 13" fill="#ffb3c7"/><circle cx="16" cy="16" r="10" fill="#ff8fb5"/><path d="M10 10 C14 14 14 18 10 22 M16 6 C20 11 20 21 16 26 M22 10 C18 14 18 18 22 22" stroke="#fff" stroke-width="1.8"/>'),
  game_memory: svg('<rect x="4" y="8" width="13" height="18" rx="2.5" fill="#9b6bd6" transform="rotate(-10 10 17)"/><rect x="14" y="6" width="13" height="18" rx="2.5" fill="#fff" transform="rotate(8 20 15)"/><path d="M20.5 11 C22 9.5 24.5 11 22.5 13.5 L20.5 15.5 L18.5 13.5 C16.5 11 19 9.5 20.5 11 Z" fill="#ff5a6e" stroke-width="1.2" transform="rotate(8 20 15)"/>'),
  game_runner: svg('<path d="M3 26 H29" stroke-width="2"/><path d="M6 22 C10 12 16 9 22 12" stroke="#6bb8ff" stroke-width="1.8" stroke-dasharray="2 2.5"/>' + '<g transform="translate(23 14) scale(0.75)"><ellipse cx="0" cy="3" rx="4.2" ry="3.6" fill="#a8693a"/><circle cx="-4.6" cy="-2" r="1.8" fill="#a8693a"/><circle cx="-1.6" cy="-4.8" r="1.8" fill="#a8693a"/><circle cx="1.6" cy="-4.8" r="1.8" fill="#a8693a"/><circle cx="4.6" cy="-2" r="1.8" fill="#a8693a"/></g><path d="M8 26 V21 L11 26" fill="#c47a3f"/>'),
  game_tricks: svg('<path d="M16 3 L28 14 H4 Z" fill="#ff6b6b"/><path d="M16 3 L12 14 M16 3 L20 14" stroke="#fff" stroke-width="1.6"/><rect x="5.5" y="14" width="21" height="13" fill="#fff4e0"/><path d="M13 27 C13 21 19 21 19 27 Z" fill="#9b6bd6"/><path d="M16 3 V0.5 L19 1.5 L16 2.5" fill="#ffd23f" stroke-width="1"/>'),
  comp_beauty: svg('<path d="M16 15 C11 8 4 8 5 14 C6 19 12 18 16 15 C20 18 26 19 27 14 C28 8 21 8 16 15 Z" fill="#ff8fb5"/><circle cx="16" cy="15" r="3" fill="#ff5a8a"/><path d="M14 17 L11 27 L15 25 L16 28 M18 17 L21 27 L17 25" fill="#ff8fb5"/>'),
};

/** Ids de los juegos/competencias → icono. */
const GAME_ALIAS: Record<string, string> = {
  bubbles: 'game_bubbles', cups: 'game_cups', catch: 'game_catch', memory: 'game_memory', runner: 'game_runner', tricks: 'game_tricks',
  agility_race: 'game_runner', beauty_contest: 'comp_beauty', trick_show: 'game_tricks',
};

/** SVG de un objeto (o null si no tiene dibujo propio). */
export function itemSVG(id: string): string | null {
  return ICONS[id] ?? null;
}

/** SVG de un juego o competencia. */
export function gameSVG(id: string): string | null {
  return ICONS[GAME_ALIAS[id] ?? ''] ?? null;
}
