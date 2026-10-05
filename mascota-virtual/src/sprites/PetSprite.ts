/**
 * Generador de sprites 2D (SVG) de las mascotas.
 *
 * Los sprites se dibujan por código para que:
 *  - el color, patrón y tamaño salgan de los genes (crías distintas a sus padres),
 *  - cambien de proporciones según la etapa (los bebés son cabezones),
 *  - muestren el estado de ánimo (feliz, triste, dormido, sucio, enfermo...),
 *  - lleven puestos los accesorios equipados.
 *
 * Para añadir una especie nueva: crea una función `drawX(ctx)` y regístrala en `DRAWERS`.
 * Si más adelante se usan sprites dibujados a mano (PNG), este módulo es el único a cambiar.
 */
import type { PetMood } from '../systems/pet/Pet';
import { GrowthStage, Sex, type AccessorySlot, type CoatPattern, type PetGenes } from '../systems/pet/PetTypes';
import { drawAccessory } from './Accessories';
import { mix, shade } from './color';

export interface SpriteOptions {
  speciesId: string;
  genes: Pick<PetGenes, 'primaryColor' | 'secondaryColor' | 'pattern' | 'size'>;
  stage: GrowthStage;
  mood?: PetMood;
  sex?: Sex;
  equipped?: Partial<Record<AccessorySlot, string>>;
  /** Clase CSS extra para el <svg>. */
  className?: string;
}

/** Contexto de dibujo compartido por todas las especies. */
interface Ctx {
  p: string; // color principal
  s: string; // color secundario
  o: string; // contorno
  dark: string;
  light: string;
  pattern: CoatPattern;
  mood: PetMood;
  eyeScale: number;
  sex?: Sex;
  id: string; // prefijo único para ids de clipPath
}

/** Puntos donde se colocan los accesorios (coordenadas de adulto). */
interface Anchors {
  head: { x: number; y: number; s: number };
  face: { x: number; y: number; w: number };
  neck: { x: number; y: number; w: number };
}

interface SpeciesParts {
  /** Lo que va detrás del cuerpo (cola, alas traseras...). */
  behind: string;
  body: string;
  head: string;
  /** Punto sobre el que escala la cabeza (cuello). */
  pivot: [number, number];
  anchors: Anchors;
}

const STAGE_SCALE: Record<GrowthStage, number> = {
  [GrowthStage.Baby]: 0.62,
  [GrowthStage.Puppy]: 0.75,
  [GrowthStage.Juvenile]: 0.88,
  [GrowthStage.Adult]: 1,
  [GrowthStage.Senior]: 1,
};
/** Los pequeños tienen la cabeza proporcionalmente más grande. */
const HEAD_SCALE: Record<GrowthStage, number> = {
  [GrowthStage.Baby]: 1.28,
  [GrowthStage.Puppy]: 1.15,
  [GrowthStage.Juvenile]: 1.06,
  [GrowthStage.Adult]: 1,
  [GrowthStage.Senior]: 1,
};
const EYE_SCALE: Record<GrowthStage, number> = {
  [GrowthStage.Baby]: 1.3,
  [GrowthStage.Puppy]: 1.15,
  [GrowthStage.Juvenile]: 1.05,
  [GrowthStage.Adult]: 1,
  [GrowthStage.Senior]: 0.95,
};

// ------------------------------------------------------------------
// Piezas comunes
// ------------------------------------------------------------------

const INK = '#2b1d16';

function ell(cx: number, cy: number, rx: number, ry: number, fill: string, o = '', extra = ''): string {
  const stroke = o ? ` stroke="${o}" stroke-width="3"` : '';
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"${stroke} ${extra}/>`;
}

function path(d: string, fill: string, o = '', extra = ''): string {
  const stroke = o ? ` stroke="${o}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"` : '';
  return `<path d="${d}" fill="${fill}"${stroke} ${extra}/>`;
}

/** Ojos según el estado de ánimo. */
function eyes(c: Ctx, lx: number, rx: number, y: number, r = 6): string {
  r *= c.eyeScale;
  const arc = (x: number, up: boolean) =>
    `<path d="M${x - r} ${y} Q${x} ${up ? y - r * 1.4 : y + r * 1.2} ${x + r} ${y}" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`;
  const open = (x: number) =>
    `<ellipse cx="${x}" cy="${y}" rx="${r * 0.85}" ry="${r}" fill="${INK}"/>` +
    `<circle cx="${x + r * 0.3}" cy="${y - r * 0.4}" r="${r * 0.35}" fill="#fff"/>` +
    `<circle cx="${x - r * 0.35}" cy="${y + r * 0.35}" r="${r * 0.15}" fill="#fff"/>`;
  const half = (x: number) =>
    `<path d="M${x - r} ${y - 1} Q${x} ${y + r * 1.3} ${x + r} ${y - 1} Z" fill="${INK}"/>` +
    `<line x1="${x - r - 1}" y1="${y - 1}" x2="${x + r + 1}" y2="${y - 1}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
  const lashes = (x: number, dir: number) =>
    c.sex === Sex.Female
      ? `<path d="M${x + dir * r * 0.75} ${y - r * 0.55} l${dir * 3.5} -1.5 M${x + dir * r * 0.85} ${y - r * 0.15} l${dir * 3.5} 0" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`
      : '';

  switch (c.mood) {
    case 'happy':
      return arc(lx, true) + arc(rx, true);
    case 'sleeping':
      return arc(lx, false) + arc(rx, false);
    case 'tired':
    case 'sick':
      return half(lx) + half(rx);
    case 'sad': {
      const brows =
        `<path d="M${lx - r} ${y - r * 1.9} L${lx + r} ${y - r * 1.4}" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>` +
        `<path d="M${rx + r} ${y - r * 1.9} L${rx - r} ${y - r * 1.4}" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`;
      const tear = `<path d="M${rx + r * 0.6} ${y + r} q-3 6 0 8 q3 -2 0 -8z" fill="#7cc6ff"/>`;
      return open(lx) + open(rx) + brows + tear;
    }
    default:
      return open(lx) + open(rx) + lashes(lx, -1) + lashes(rx, 1);
  }
}

/** Boca según el estado de ánimo. `style` adapta la forma a la especie. */
function mouth(c: Ctx, x: number, y: number, style: 'w' | 'smile' = 'smile'): string {
  const st = `fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"`;
  switch (c.mood) {
    case 'happy':
      return `<path d="M${x - 9} ${y} Q${x} ${y + 14} ${x + 9} ${y} Z" fill="#7a2e2e" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>` +
        `<path d="M${x - 5} ${y + 6} Q${x} ${y + 2} ${x + 5} ${y + 6} Q${x} ${y + 11} ${x - 5} ${y + 6}Z" fill="#ff8fa3"/>`;
    case 'sad':
    case 'sick':
      return `<path d="M${x - 7} ${y + 5} Q${x} ${y - 2} ${x + 7} ${y + 5}" ${st}/>`;
    case 'hungry':
      return `<ellipse cx="${x}" cy="${y + 3}" rx="5" ry="6" fill="#7a2e2e" stroke="${INK}" stroke-width="2"/>` +
        `<path d="M${x + 4} ${y + 8} q2 6 0 9 q-3 -2 0 -9z" fill="#9fd8ff"/>`;
    case 'sleeping':
      return `<ellipse cx="${x}" cy="${y + 3}" rx="3" ry="3.5" fill="#7a2e2e"/>`;
    case 'dirty':
    case 'tired':
      return `<path d="M${x - 7} ${y + 2} q3.5 -3 7 0 t7 0" ${st}/>`;
    default:
      return style === 'w'
        ? `<path d="M${x - 8} ${y} q4 5 8 0 q4 5 8 0" ${st}/>`
        : `<path d="M${x - 7} ${y} Q${x} ${y + 7} ${x + 7} ${y}" ${st}/>`;
  }
}

/** Mofletes rosados (o verdosos si está enfermo). */
function cheeks(c: Ctx, lx: number, rx: number, y: number, r = 6): string {
  const col = c.mood === 'sick' ? '#9ccf7a' : '#ff9eb0';
  return ell(lx, y, r * 1.2, r * 0.75, col, '', 'opacity="0.65"') + ell(rx, y, r * 1.2, r * 0.75, col, '', 'opacity="0.65"');
}

/**
 * Capa de patrón (manchas, rayas, parche) recortada a una forma.
 * `box` es el rectángulo aproximado de la zona a decorar.
 */
function patternLayer(c: Ctx, clipShape: string, box: [number, number, number, number], color: string): string {
  if (c.pattern === 'plain') return '';
  const [x, y, w, h] = box;
  const id = `${c.id}_clip_${Math.round(x)}_${Math.round(y)}`;
  let shapes = '';
  if (c.pattern === 'spots') {
    const spots: [number, number, number][] = [
      [0.22, 0.3, 0.13], [0.7, 0.22, 0.1], [0.55, 0.62, 0.15], [0.18, 0.78, 0.1], [0.86, 0.7, 0.09],
    ];
    shapes = spots.map(([fx, fy, fr]) => `<circle cx="${x + fx * w}" cy="${y + fy * h}" r="${fr * Math.min(w, h) * 1.4}" fill="${color}"/>`).join('');
  } else if (c.pattern === 'stripes') {
    for (let i = 1; i <= 4; i++) {
      const sx = x + (i / 5) * w;
      shapes += `<path d="M${sx - 4} ${y - 2} q8 ${h * 0.25} 0 ${h * 0.5} q-8 ${h * 0.25} 0 ${h * 0.5}" stroke="${color}" stroke-width="${w * 0.06}" fill="none" stroke-linecap="round"/>`;
    }
  } else if (c.pattern === 'patch') {
    shapes = `<ellipse cx="${x + w * 0.25}" cy="${y + h * 0.3}" rx="${w * 0.32}" ry="${h * 0.3}" fill="${color}"/>`;
  }
  return `<clipPath id="${id}">${clipShape}</clipPath><g clip-path="url(#${id})" opacity="0.9">${shapes}</g>`;
}

// ------------------------------------------------------------------
// Especies
// ------------------------------------------------------------------

function drawDog(c: Ctx): SpeciesParts {
  const bodyShape = `<ellipse cx="100" cy="140" rx="42" ry="34"/>`;
  const headShape = `<circle cx="100" cy="88" r="40"/>`;
  const ear = c.dark;
  return {
    behind: `<g class="pet-tail" style="transform-origin:136px 132px">${path('M134 134 Q160 120 156 96 Q150 112 132 124 Z', c.p, c.o)}</g>`,
    body:
      ell(66, 164, 12, 13, c.p, c.o) + ell(134, 164, 12, 13, c.p, c.o) +
      ell(100, 140, 42, 34, c.p, c.o) +
      patternLayer(c, bodyShape, [58, 106, 84, 68], c.dark) +
      ell(100, 150, 24, 20, c.s) +
      ell(82, 170, 12, 11, c.p, c.o) + ell(118, 170, 12, 11, c.p, c.o) +
      ell(82, 174, 7, 4, c.s) + ell(118, 174, 7, 4, c.s),
    head:
      `<g class="pet-ear-l">${ell(64, 92, 14, 27, ear, c.o, 'transform="rotate(18 64 92)"')}</g>` +
      `<g class="pet-ear-r">${ell(136, 92, 14, 27, ear, c.o, 'transform="rotate(-18 136 92)"')}</g>` +
      `<circle cx="100" cy="88" r="40" fill="${c.p}" stroke="${c.o}" stroke-width="3"/>` +
      patternLayer(c, headShape, [60, 48, 80, 80], c.dark) +
      ell(100, 106, 21, 15, c.s) +
      eyes(c, 84, 116, 86) +
      ell(100, 99, 7, 5, INK) +
      mouth(c, 100, 106, 'w') +
      cheeks(c, 74, 126, 100),
    pivot: [100, 122],
    anchors: { head: { x: 100, y: 52, s: 1 }, face: { x: 100, y: 86, w: 32 }, neck: { x: 100, y: 127, w: 46 } },
  };
}

function drawCat(c: Ctx): SpeciesParts {
  const bodyShape = `<ellipse cx="100" cy="142" rx="38" ry="32"/>`;
  const headShape = `<ellipse cx="100" cy="90" rx="42" ry="37"/>`;
  return {
    behind: `<g class="pet-tail" style="transform-origin:132px 150px">${path('M130 152 Q170 150 166 112 Q164 96 152 100 Q158 112 156 124 Q150 140 126 140 Z', c.p, c.o)}</g>`,
    body:
      ell(100, 142, 38, 32, c.p, c.o) +
      patternLayer(c, bodyShape, [62, 110, 76, 64], c.dark) +
      ell(100, 150, 20, 18, c.s) +
      ell(84, 170, 11, 10, c.p, c.o) + ell(116, 170, 11, 10, c.p, c.o) +
      ell(84, 174, 6, 3.5, '#ffb3c1') + ell(116, 174, 6, 3.5, '#ffb3c1'),
    head:
      path('M64 76 L68 36 L96 58 Z', c.p, c.o) + path('M136 76 L132 36 L104 58 Z', c.p, c.o) +
      path('M70 66 L72 46 L88 59 Z', '#ffb3c1') + path('M130 66 L128 46 L112 59 Z', '#ffb3c1') +
      `<ellipse cx="100" cy="90" rx="42" ry="37" fill="${c.p}" stroke="${c.o}" stroke-width="3"/>` +
      patternLayer(c, headShape, [58, 53, 84, 74], c.dark) +
      ell(100, 104, 16, 11, c.s) +
      eyes(c, 82, 118, 88, 6.5) +
      path('M96 99 L104 99 L100 104 Z', '#ff8fa3') +
      mouth(c, 100, 105, 'w') +
      `<g stroke="${INK}" stroke-width="1.6" stroke-linecap="round" opacity="0.7">` +
      `<line x1="58" y1="98" x2="80" y2="101"/><line x1="58" y1="106" x2="80" y2="105"/>` +
      `<line x1="142" y1="98" x2="120" y2="101"/><line x1="142" y1="106" x2="120" y2="105"/></g>` +
      cheeks(c, 72, 128, 100),
    pivot: [100, 124],
    anchors: { head: { x: 100, y: 56, s: 1 }, face: { x: 100, y: 88, w: 36 }, neck: { x: 100, y: 127, w: 44 } },
  };
}

function drawRabbit(c: Ctx): SpeciesParts {
  const bodyShape = `<ellipse cx="100" cy="145" rx="36" ry="32"/>`;
  const headShape = `<circle cx="100" cy="94" r="37"/>`;
  return {
    behind: `<g class="pet-tail" style="transform-origin:134px 150px"><circle cx="136" cy="152" r="11" fill="#ffffff" stroke="${c.o}" stroke-width="3"/></g>`,
    body:
      ell(100, 145, 36, 32, c.p, c.o) +
      patternLayer(c, bodyShape, [64, 113, 72, 64], c.dark) +
      ell(100, 152, 19, 17, mix(c.s, '#ffffff', 0.6)) +
      ell(78, 173, 16, 9, c.p, c.o) + ell(122, 173, 16, 9, c.p, c.o) +
      ell(80, 150, 6, 8, c.p, c.o, 'transform="rotate(20 80 150)"') + ell(120, 150, 6, 8, c.p, c.o, 'transform="rotate(-20 120 150)"'),
    head:
      `<g class="pet-ear-l">${ell(84, 42, 11, 32, c.p, c.o, 'transform="rotate(-8 84 70)"')}${ell(84, 44, 5, 23, '#ffb3c1', '', 'transform="rotate(-8 84 70)"')}</g>` +
      `<g class="pet-ear-r">${ell(116, 42, 11, 32, c.p, c.o, 'transform="rotate(8 116 70)"')}${ell(116, 44, 5, 23, '#ffb3c1', '', 'transform="rotate(8 116 70)"')}</g>` +
      `<circle cx="100" cy="94" r="37" fill="${c.p}" stroke="${c.o}" stroke-width="3"/>` +
      patternLayer(c, headShape, [63, 57, 74, 74], c.dark) +
      eyes(c, 85, 115, 92, 6) +
      ell(100, 104, 4.5, 3.5, '#ff8fa3') +
      mouth(c, 100, 108) +
      `<rect x="96" y="${c.mood === 'happy' ? 116 : 111}" width="8" height="7" rx="1.5" fill="#fff" stroke="${INK}" stroke-width="1.5"/>` +
      cheeks(c, 75, 125, 104),
    pivot: [100, 126],
    anchors: { head: { x: 100, y: 62, s: 0.85 }, face: { x: 100, y: 92, w: 30 }, neck: { x: 100, y: 130, w: 42 } },
  };
}

function drawParrot(c: Ctx): SpeciesParts {
  const bodyShape = `<ellipse cx="100" cy="132" rx="35" ry="44"/>`;
  const wing = shade(c.p, 0.18);
  return {
    behind:
      `<g class="pet-tail" style="transform-origin:100px 165px">` +
      path('M88 160 L80 194 L94 190 L100 162 Z', c.s, c.o) + path('M112 160 L120 194 L106 190 L100 162 Z', c.s, c.o) +
      path('M94 162 L100 198 L106 162 Z', wing, c.o) + `</g>`,
    body:
      ell(100, 132, 35, 44, c.p, c.o) +
      patternLayer(c, bodyShape, [65, 88, 70, 88], wing) +
      ell(100, 140, 20, 28, c.s, '', 'opacity="0.85"') +
      `<g class="pet-wing-l">${ell(70, 132, 13, 30, wing, c.o, 'transform="rotate(14 70 132)"')}</g>` +
      `<g class="pet-wing-r">${ell(130, 132, 13, 30, wing, c.o, 'transform="rotate(-14 130 132)"')}</g>` +
      `<g stroke="#8a8a8a" stroke-width="4" stroke-linecap="round"><path d="M88 172 l-4 8 M88 172 l2 9 M112 172 l4 8 M112 172 l-2 9"/></g>`,
    head:
      path('M96 48 Q90 30 98 22 Q100 36 102 48 Z', c.s, c.o) +
      path('M90 52 Q78 38 82 28 Q88 42 96 50 Z', c.p, c.o) +
      path('M108 50 Q120 38 120 28 Q112 42 104 50 Z', c.p, c.o) +
      `<circle cx="100" cy="80" r="33" fill="${c.p}" stroke="${c.o}" stroke-width="3"/>` +
      ell(84, 80, 11, 12, '#ffffff') + ell(116, 80, 11, 12, '#ffffff') +
      eyes(c, 84, 116, 80, 5.5) +
      path('M90 90 Q100 84 110 90 Q112 104 100 112 Q102 100 90 90 Z', '#f2c14e', c.o) +
      path('M92 96 Q100 104 108 96 Q104 104 100 106 Q96 104 92 96 Z', '#3a3a3a') +
      cheeks(c, 72, 128, 96, 5),
    pivot: [100, 108],
    anchors: { head: { x: 100, y: 50, s: 0.9 }, face: { x: 100, y: 80, w: 32 }, neck: { x: 100, y: 112, w: 42 } },
  };
}

function drawTurtle(c: Ctx): SpeciesParts {
  // En la tortuga el color principal es la piel y el secundario el caparazón
  const shellShape = `<path d="M44 160 Q44 104 100 102 Q156 104 156 160 Z"/>`;
  const plate = shade(c.s, 0.25);
  return {
    behind:
      ell(56, 168, 14, 11, c.p, c.o) + ell(144, 168, 14, 11, c.p, c.o) +
      `<g class="pet-tail" style="transform-origin:150px 156px">${path('M150 154 L168 160 L150 162 Z', c.p, c.o)}</g>`,
    body:
      path('M44 160 Q44 104 100 102 Q156 104 156 160 Z', c.s, c.o) +
      `<g fill="none" stroke="${plate}" stroke-width="3" stroke-linejoin="round">` +
      `<path d="M82 116 L118 116 L128 138 L100 156 L72 138 Z"/><path d="M72 138 L50 146 M128 138 L150 146 M82 116 L70 106 M118 116 L130 106 M100 156 L100 160"/></g>` +
      patternLayer(c, shellShape, [44, 102, 112, 58], shade(c.s, -0.3)) +
      path('M40 160 Q100 172 160 160 Q160 168 100 176 Q40 168 40 160 Z', shade(c.s, 0.12), c.o) +
      ell(76, 176, 13, 9, c.p, c.o) + ell(124, 176, 13, 9, c.p, c.o),
    head:
      ell(100, 132, 14, 16, c.p, c.o) +
      `<circle cx="100" cy="104" r="30" fill="${c.p}" stroke="${c.o}" stroke-width="3"/>` +
      eyes(c, 88, 112, 100, 5.5) +
      mouth(c, 100, 114) +
      cheeks(c, 80, 120, 112, 5),
    pivot: [100, 134],
    anchors: { head: { x: 100, y: 76, s: 0.8 }, face: { x: 100, y: 100, w: 24 }, neck: { x: 100, y: 134, w: 30 } },
  };
}

function drawHamster(c: Ctx): SpeciesParts {
  const blob = `<ellipse cx="100" cy="126" rx="52" ry="50"/>`;
  return {
    behind: '',
    body:
      ell(76, 176, 12, 7, '#ffb3c1', c.o) + ell(124, 176, 12, 7, '#ffb3c1', c.o) +
      ell(100, 126, 52, 50, c.p, c.o) +
      patternLayer(c, blob, [48, 76, 104, 100], c.dark) +
      ell(100, 150, 32, 24, c.s),
    head:
      `<g class="pet-ear-l"><circle cx="64" cy="84" r="13" fill="${c.p}" stroke="${c.o}" stroke-width="3"/><circle cx="64" cy="84" r="7" fill="#ffb3c1"/></g>` +
      `<g class="pet-ear-r"><circle cx="136" cy="84" r="13" fill="${c.p}" stroke="${c.o}" stroke-width="3"/><circle cx="136" cy="84" r="7" fill="#ffb3c1"/></g>` +
      ell(70, 126, 16, 13, mix(c.s, '#ffd1dc', 0.3)) + ell(130, 126, 16, 13, mix(c.s, '#ffd1dc', 0.3)) +
      eyes(c, 82, 118, 110, 6) +
      ell(100, 120, 4, 3, '#ff8fa3') +
      mouth(c, 100, 124) +
      cheeks(c, 70, 130, 124, 7) +
      ell(80, 146, 5.5, 5, '#ffb3c1', c.o) + ell(120, 146, 5.5, 5, '#ffb3c1', c.o),
    pivot: [100, 150],
    anchors: { head: { x: 100, y: 80, s: 0.95 }, face: { x: 100, y: 110, w: 36 }, neck: { x: 100, y: 140, w: 56 } },
  };
}

/** Registro de dibujantes por especie (extensible). */
export const DRAWERS: Record<string, (c: Ctx) => SpeciesParts> = {
  dog: drawDog,
  cat: drawCat,
  rabbit: drawRabbit,
  parrot: drawParrot,
  turtle: drawTurtle,
  hamster: drawHamster,
};

// ------------------------------------------------------------------
// Composición final
// ------------------------------------------------------------------

/** Efectos visuales del estado de ánimo encima del sprite. */
function moodOverlay(c: Ctx): string {
  switch (c.mood) {
    case 'dirty':
      return (
        `<g fill="#7a5a3a" opacity="0.55"><ellipse cx="78" cy="140" rx="9" ry="6"/><ellipse cx="122" cy="152" rx="7" ry="5"/><ellipse cx="110" cy="128" rx="5" ry="4"/></g>` +
        `<g class="pet-flies" fill="${INK}"><circle cx="58" cy="60" r="2.5"/><circle cx="146" cy="70" r="2.5"/><circle cx="150" cy="46" r="2"/></g>`
      );
    case 'sick':
      return `<path class="pet-sweat" d="M142 64 q-6 10 0 14 q6 -4 0 -14z" fill="#9fd8ff" stroke="#5aa9e6" stroke-width="1.5"/>`;
    default:
      return '';
  }
}

/** Genera el SVG completo de una mascota. */
export function renderPetSVG(opts: SpriteOptions): string {
  const draw = DRAWERS[opts.speciesId] ?? drawDog;
  const senior = opts.stage === GrowthStage.Senior;
  // Los seniors tienen el pelaje un poco canoso
  const p = senior ? mix(opts.genes.primaryColor, '#d8d8d8', 0.3) : opts.genes.primaryColor;
  const s = senior ? mix(opts.genes.secondaryColor, '#e8e8e8', 0.3) : opts.genes.secondaryColor;
  const c: Ctx = {
    p,
    s,
    o: shade(p, 0.55),
    dark: shade(p, 0.28),
    light: shade(p, -0.3),
    pattern: opts.genes.pattern,
    mood: opts.mood ?? 'normal',
    eyeScale: EYE_SCALE[opts.stage],
    sex: opts.sex,
    // Id determinista: dos sprites iguales comparten clipPath idéntico (inofensivo) y
    // el HTML generado es estable, lo que permite comparar renders sin redibujar.
    id: `pet_${opts.speciesId}`,
  };
  const parts = draw(c);
  const scale = STAGE_SCALE[opts.stage] * opts.genes.size;
  const hs = HEAD_SCALE[opts.stage];
  const [px, py] = parts.pivot;
  const a = parts.anchors;
  const eq = opts.equipped ?? {};

  const headAcc = eq.head ? drawAccessory(eq.head, a.head.x, a.head.y, a.head.s) : '';
  const faceAcc = eq.face ? drawAccessory(eq.face, a.face.x, a.face.y, a.face.w / 32) : '';
  const neckAcc = eq.neck ? drawAccessory(eq.neck, a.neck.x, a.neck.y, a.neck.w / 50) : '';
  const seniorBrows = senior
    ? `<g stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"><path d="M${a.face.x - a.face.w / 2 - 7} ${a.face.y - 13} l12 -2"/><path d="M${a.face.x + a.face.w / 2 + 7} ${a.face.y - 13} l-12 -2"/></g>`
    : '';
  const zzz =
    c.mood === 'sleeping'
      ? `<g class="pet-zzz" fill="#6b7fd7" font-family="sans-serif" font-weight="bold"><text x="140" y="56" font-size="18">Z</text><text x="156" y="38" font-size="13">z</text><text x="168" y="24" font-size="10">z</text></g>`
      : '';

  return (
    `<svg class="pet-svg ${opts.className ?? ''}" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">` +
    `<ellipse cx="100" cy="186" rx="${48 * scale}" ry="${7 * scale}" fill="#000" opacity="0.15"/>` +
    `<g transform="translate(100 186) scale(${scale.toFixed(3)}) translate(-100 -186)">` +
    `<g class="pet-root">` +
    parts.behind +
    parts.body +
    `<g transform="translate(${px} ${py}) scale(${hs}) translate(${-px} ${-py})">` +
    `<g class="pet-head" style="transform-origin:${px}px ${py}px">` +
    parts.head +
    seniorBrows +
    faceAcc +
    headAcc +
    `</g></g>` +
    neckAcc +
    moodOverlay(c) +
    `</g></g>` +
    zzz +
    `</svg>`
  );
}
