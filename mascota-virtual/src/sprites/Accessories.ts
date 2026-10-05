/**
 * Sprites de accesorios equipables. Cada uno se dibuja alrededor de (0,0)
 * y se coloca en el punto de anclaje de la especie (cabeza, cara o cuello).
 *
 * Para añadir un accesorio nuevo: crea su item en `data/items.ts` y su
 * dibujo aquí con el mismo id.
 */
const O = '#2b1d16';

type Drawer = () => string;

/** Cabeza: (0,0) = parte superior de la cabeza, donde se apoya el sombrero. */
const HEAD: Record<string, Drawer> = {
  acc_bow: () =>
    `<g transform="translate(22 4) rotate(15)">` +
    `<path d="M0 0 L-18 -12 L-18 12 Z" fill="#ff6fa5" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<path d="M0 0 L18 -12 L18 12 Z" fill="#ff6fa5" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<circle r="6" fill="#ff3d84" stroke="${O}" stroke-width="2.5"/></g>`,
  acc_cap: () =>
    `<path d="M-30 4 Q-30 -30 0 -30 Q30 -30 30 4 Z" fill="#3b82f6" stroke="${O}" stroke-width="2.5"/>` +
    `<path d="M-6 2 Q24 -6 46 6 Q24 12 -6 8 Z" fill="#2563eb" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<circle cx="0" cy="-30" r="4" fill="#fff" stroke="${O}" stroke-width="2"/>` +
    `<path d="M-14 -12 L14 -12" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`,
  acc_flower: () =>
    `<g transform="translate(-24 6)">` +
    [0, 72, 144, 216, 288]
      .map((a) => `<ellipse cx="0" cy="-9" rx="6" ry="9" fill="#ffb7d5" stroke="${O}" stroke-width="2" transform="rotate(${a})"/>`)
      .join('') +
    `<circle r="5" fill="#ffd23f" stroke="${O}" stroke-width="2"/></g>`,
  acc_tophat: () =>
    `<ellipse cx="0" cy="2" rx="32" ry="7" fill="#222" stroke="${O}" stroke-width="2.5"/>` +
    `<rect x="-20" y="-38" width="40" height="40" rx="3" fill="#222" stroke="${O}" stroke-width="2.5"/>` +
    `<rect x="-20" y="-10" width="40" height="7" fill="#c0392b"/>`,
  acc_crown: () =>
    `<path d="M-26 4 L-26 -18 L-13 -6 L0 -26 L13 -6 L26 -18 L26 4 Z" fill="#ffd23f" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<circle cx="0" cy="-6" r="4" fill="#e63946"/><circle cx="-15" cy="-2" r="3" fill="#4cc9f0"/><circle cx="15" cy="-2" r="3" fill="#4cc9f0"/>`,
};

/** Cara: (0,0) = centro entre los ojos; la escala viene de la separación de ojos. */
const FACE: Record<string, Drawer> = {
  acc_glasses: () =>
    `<rect x="-29" y="-9" width="24" height="17" rx="6" fill="#1d1d1d" stroke="${O}" stroke-width="2.5"/>` +
    `<rect x="5" y="-9" width="24" height="17" rx="6" fill="#1d1d1d" stroke="${O}" stroke-width="2.5"/>` +
    `<path d="M-5 -3 Q0 -7 5 -3" stroke="${O}" stroke-width="3" fill="none"/>` +
    `<path d="M-24 -5 l8 0" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>` +
    `<path d="M10 -5 l8 0" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>`,
  acc_monocle: () =>
    `<circle cx="-16" cy="0" r="12" fill="#bde0fe" fill-opacity="0.35" stroke="#8d5524" stroke-width="3"/>` +
    `<circle cx="16" cy="0" r="12" fill="#bde0fe" fill-opacity="0.35" stroke="#8d5524" stroke-width="3"/>` +
    `<path d="M-4 -2 Q0 -6 4 -2" stroke="#8d5524" stroke-width="3" fill="none"/>`,
};

/** Cuello: (0,0) = centro del cuello. */
const NECK: Record<string, Drawer> = {
  acc_scarf: () =>
    `<path d="M-30 -6 Q0 8 30 -6 L30 6 Q0 20 -30 6 Z" fill="#e63946" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<path d="M10 6 L22 34 L8 34 L2 10 Z" fill="#c1121f" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<path d="M-20 2 l0 6 M-8 6 l0 6 M14 0 l0 6" stroke="#ffd6d6" stroke-width="2.5"/>`,
  acc_bell: () =>
    `<path d="M-28 -4 Q0 8 28 -4 L28 2 Q0 14 -28 2 Z" fill="#e63946" stroke="${O}" stroke-width="2.5"/>` +
    `<circle cx="0" cy="14" r="8" fill="#ffd23f" stroke="${O}" stroke-width="2.5"/>` +
    `<path d="M-5 14 L5 14" stroke="${O}" stroke-width="2"/><circle cx="0" cy="18" r="1.8" fill="${O}"/>`,
  acc_bowtie: () =>
    `<path d="M0 4 L-18 -8 L-18 16 Z" fill="#6d28d9" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<path d="M0 4 L18 -8 L18 16 Z" fill="#6d28d9" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<rect x="-5" y="-1" width="10" height="10" rx="3" fill="#8b5cf6" stroke="${O}" stroke-width="2.5"/>`,
};

const ALL: Record<string, Drawer> = { ...HEAD, ...FACE, ...NECK };

/** Dibuja un accesorio en (x, y) con escala s. Devuelve '' si no tiene sprite. */
export function drawAccessory(itemId: string, x: number, y: number, s = 1): string {
  const draw = ALL[itemId];
  if (!draw) return '';
  return `<g class="pet-acc" transform="translate(${x} ${y}) scale(${s.toFixed(3)})">${draw()}</g>`;
}

/** Icono SVG de un accesorio (para la tienda / inventario). */
export function accessoryIconSVG(itemId: string): string | null {
  const draw = ALL[itemId];
  if (!draw) return null;
  // Centrado del icono (algunos accesorios de cabeza van desplazados a un lado en la mascota)
  const offsets: Record<string, [number, number]> = { acc_bow: [-22, -4], acc_flower: [24, -6] };
  const [ox, oy] = offsets[itemId] ?? [0, HEAD[itemId] ? 14 : 2];
  return `<svg viewBox="-40 -40 80 80" xmlns="http://www.w3.org/2000/svg"><g transform="translate(${ox} ${oy})">${draw()}</g></svg>`;
}
