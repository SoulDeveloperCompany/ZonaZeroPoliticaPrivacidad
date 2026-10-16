/**
 * Iconos propios en SVG (estilo "pegatina": contorno marrón redondeado + colores de la paleta del juego).
 * Sustituyen a los emojis en navegación, acciones de la casa y monedero, que se veían distintos
 * en cada móvil Android (auditoría de diseño 2026-10).
 *
 * Uso: icon('home'). Tamaño por CSS (.ui-icon, por defecto 1em).
 */
const K = '#3a2a20';

const svg = (body: string): string =>
  `<svg class="ui-icon" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="${K}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;

/** Huella pequeña (almohadilla + 4 dedos) sin contorno. */
const paw = (cx: number, cy: number, s: number, fill: string): string =>
  `<g fill="${fill}" stroke="${K}" stroke-width="${1.6 / s}" transform="translate(${cx} ${cy}) scale(${s})">` +
  '<ellipse cx="0" cy="3" rx="4.2" ry="3.6"/><circle cx="-4.6" cy="-2" r="1.8"/><circle cx="-1.6" cy="-4.8" r="1.8"/><circle cx="1.6" cy="-4.8" r="1.8"/><circle cx="4.6" cy="-2" r="1.8"/></g>';

const HEART = 'M16 27 C6 20 3 14 6 9.5 C8.5 6 13 6.5 16 10.5 C19 6.5 23.5 6 26 9.5 C29 14 26 20 16 27 Z';
const STAR = 'M16 3.5 L19.6 11.5 L28.4 12.5 L21.9 18.4 L23.6 27 L16 22.7 L8.4 27 L10.1 18.4 L3.6 12.5 L12.4 11.5 Z';

const ICONS: Record<string, string> = {
  home: svg(
    '<path d="M7 14 V27 H25 V14" fill="#ffe3c4"/>' +
      '<path d="M3.5 15.5 L16 4.5 L28.5 15.5 Z" fill="#ff8a3d"/>' +
      '<rect x="13.5" y="19" width="5" height="8" rx="2" fill="#c47a3f"/>',
  ),
  shop: svg(
    '<path d="M11 11 V9 a5 5 0 0 1 10 0 V11"/>' +
      '<path d="M5.5 11 H26.5 L24.8 27 H7.2 Z" fill="#ff7eb0"/>' +
      '<path d="M16 23 C12 20.5 11.5 18.5 12.6 17.3 C13.6 16.3 15.2 16.6 16 17.8 C16.8 16.6 18.4 16.3 19.4 17.3 C20.5 18.5 20 20.5 16 23 Z" fill="#fff" stroke-width="1.4"/>',
  ),
  events: svg(
    '<path d="M10 8 H6.5 a3.5 3.5 0 0 0 3.8 6"/><path d="M22 8 H25.5 a3.5 3.5 0 0 1 -3.8 6"/>' +
      '<path d="M10 5.5 H22 V12.5 a6 6 0 0 1 -12 0 Z" fill="#ffc93c"/>' +
      '<path d="M14 18.5 H18 V23 H14 Z" fill="#ffc93c"/>' +
      '<rect x="9.5" y="23" width="13" height="4.5" rx="1.5" fill="#c47a3f"/>',
  ),
  park: svg(
    '<rect x="14" y="17" width="4" height="11" rx="1" fill="#a8693a"/>' +
      '<circle cx="10" cy="15" r="5.5" fill="#5bb35a"/><circle cx="22" cy="15" r="5.5" fill="#5bb35a"/><circle cx="16" cy="10.5" r="7" fill="#6cc56a"/>' +
      '<g stroke="none"><circle cx="10" cy="15" r="5.5" fill="#5bb35a"/><circle cx="22" cy="15" r="5.5" fill="#5bb35a"/><circle cx="16" cy="10.5" r="7" fill="#6cc56a"/></g>' +
      '<circle cx="13" cy="8" r="1.6" fill="#a6e39a" stroke="none"/>',
  ),
  family: svg(
    `<path d="${HEART}" fill="#ff8fb5" transform="translate(-3 1) scale(0.85)"/>` +
      `<path d="${HEART}" fill="#ffb15e" transform="translate(9.5 9) scale(0.62)" stroke-width="3"/>`,
  ),
  album: svg(
    '<path d="M11 10 L13 6.5 H19 L21 10" fill="#6bb8ff"/>' +
      '<rect x="4" y="10" width="24" height="16" rx="4" fill="#6bb8ff"/>' +
      '<circle cx="16" cy="18" r="5" fill="#fff"/><circle cx="16" cy="18" r="2.2" fill="' + K + '" stroke="none"/>' +
      '<circle cx="23.5" cy="13.5" r="1.2" fill="#fff" stroke="none"/>',
  ),
  coin: svg(
    '<circle cx="16" cy="16" r="12" fill="#ffc93c"/>' +
      '<circle cx="16" cy="16" r="8.3" stroke="#e0a020" stroke-width="1.6"/>' +
      paw(16, 16.3, 0.82, '#e0a020').replace(`stroke="${K}"`, 'stroke="none"'),
  ),
  star: svg(`<path d="${STAR}" fill="#ffd23f"/><path d="M12.5 13.5 L14.6 13.2" stroke="#fff6c9" stroke-width="2"/>`),
  feed: svg(
    '<path d="M7 16 C8 9.5 24 9.5 25 16" fill="#c47a3f"/>' +
      '<circle cx="12" cy="13" r="1.3" fill="#8a5428" stroke="none"/><circle cx="17" cy="11.6" r="1.3" fill="#8a5428" stroke="none"/><circle cx="21" cy="13.4" r="1.3" fill="#8a5428" stroke="none"/>' +
      '<path d="M3.5 16 H28.5 A12.5 10 0 0 1 3.5 16 Z" fill="#ff8a3d"/>' +
      '<path d="M8 20 H24" stroke="#ffd2ad" stroke-width="2"/>',
  ),
  play: svg(
    '<circle cx="16" cy="16" r="11.5" fill="#ff6b6b"/>' +
      '<path d="M8.5 7.8 C13.5 12.5 13.5 19.5 8.5 24.2" stroke="#fff" stroke-width="2.6"/>' +
      '<path d="M23.5 7.8 C18.5 12.5 18.5 19.5 23.5 24.2" stroke="#fff" stroke-width="2.6"/>' +
      '<circle cx="16" cy="16" r="11.5"/>',
  ),
  bathe: svg(
    '<circle cx="12.5" cy="18.5" r="8" fill="#bfe8ff"/><circle cx="23" cy="10" r="5" fill="#d9f2ff"/><circle cx="24.5" cy="23.5" r="3.3" fill="#d9f2ff"/>' +
      '<path d="M8 15.5 a5 5 0 0 1 3.5 -3.2" stroke="#fff" stroke-width="2"/><path d="M20.8 8.4 a2.8 2.8 0 0 1 2 -1.4" stroke="#fff" stroke-width="1.6"/>',
  ),
  train: svg(
    '<circle cx="16" cy="16" r="12" fill="#fff"/><circle cx="16" cy="16" r="8" fill="#ff6b6b"/><circle cx="16" cy="16" r="4.3" fill="#fff"/>' +
      '<circle cx="16" cy="16" r="1.7" fill="#ff6b6b" stroke="none"/>',
  ),
  walk: svg(paw(10.5, 20, 0.95, '#a8693a') + paw(21.5, 11, 0.95, '#a8693a')),
  backpack: svg(
    '<path d="M12 9.5 V7.5 a4 4 0 0 1 8 0 V9.5"/>' +
      '<rect x="6.5" y="9" width="19" height="19" rx="6" fill="#6cc56a"/>' +
      '<rect x="10" y="18" width="12" height="7" rx="2.5" fill="#a6e39a"/>' +
      '<path d="M13 21.5 H19" stroke-width="1.6"/>',
  ),
  settings: svg(
    '<path d="M16 3.5 L18.6 3.9 L19.4 7.2 L21.7 8.5 L24.9 7.4 L26.6 9.4 L25 12.4 L25.6 15 L28.5 16.8 L28.1 19.4 L24.8 20.2 L23.5 22.5 L24.6 25.7 L22.6 27.4 L19.6 25.8 L17 26.4 L15.2 29.3 L12.6 28.9 L11.8 25.6 L9.5 24.3 L6.3 25.4 L4.6 23.4 L6.2 20.4 L5.6 17.8 L2.7 16 L3.1 13.4 L6.4 12.6 L7.7 10.3 L6.6 7.1 L8.6 5.4 L11.6 7 L14.2 6.4 Z" fill="#fff"/>' +
      '<circle cx="15.6" cy="16.4" r="4.2" fill="#ffc93c"/>',
  ),
  share: svg(
    '<path d="M7 15 V25.5 a2.5 2.5 0 0 0 2.5 2.5 H22.5 a2.5 2.5 0 0 0 2.5 -2.5 V15" fill="#bfe8ff"/>' +
      '<path d="M16 19.5 V4.5"/><path d="M10.5 9.5 L16 4 L21.5 9.5"/>',
  ),
  stats: svg(
    '<rect x="4" y="4" width="24" height="24" rx="6" fill="#fff"/>' +
      '<rect x="8.5" y="16" width="4" height="8" rx="1" fill="#6cc56a" stroke-width="1.6"/>' +
      '<rect x="14" y="10" width="4" height="14" rx="1" fill="#ffc93c" stroke-width="1.6"/>' +
      '<rect x="19.5" y="13" width="4" height="11" rx="1" fill="#ff8fb5" stroke-width="1.6"/>',
  ),
  missions: svg(
    '<rect x="6" y="5.5" width="20" height="23" rx="4" fill="#fff"/>' +
      '<rect x="11.5" y="3.5" width="9" height="4.5" rx="1.8" fill="#ffc93c"/>' +
      '<path d="M10.5 14 L12.2 15.7 L15 12.8" stroke="#5bb35a" stroke-width="2.2"/><path d="M17.5 14.3 H22"/>' +
      '<path d="M10.5 21 L12.2 22.7 L15 19.8" stroke="#5bb35a" stroke-width="2.2"/><path d="M17.5 21.3 H22"/>',
  ),
};

/** SVG del icono `name` (cadena vacía si no existe). */
export function icon(name: string): string {
  return ICONS[name] ?? '';
}

export function hasIcon(name: string): boolean {
  return name in ICONS;
}
