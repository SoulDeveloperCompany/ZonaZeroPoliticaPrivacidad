/**
 * Muebles de la casa en SVG, con el mismo estilo que las mascotas (contorno marrón redondeado).
 * Sustituyen a los emojis, que no encajaban con la habitación dibujada (auditoría de diseño 2026-10).
 * viewBox 0 0 100 100; el mueble apoya en y≈96.
 */
const K = '#3a2a20';
const wrap = (body: string, cls = ''): string =>
  `<svg class="furniture-svg ${cls}" viewBox="0 0 100 100" aria-hidden="true" stroke="${K}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;

const FURNITURE: Record<string, string> = {
  // Camita mullida: cojín ovalado con borde y almohada en forma de hueso
  furn_bed: wrap(
    '<ellipse cx="50" cy="88" rx="44" ry="8" fill="rgba(0,0,0,0.12)" stroke="none"/>' +
      '<ellipse cx="50" cy="74" rx="44" ry="20" fill="#ff8fb5"/>' +
      '<ellipse cx="50" cy="70" rx="32" ry="12" fill="#ffd6e5"/>' +
      '<path d="M18 74 Q50 98 82 74" fill="none" stroke="#e5709a" stroke-width="2.5"/>' +
      '<g transform="translate(50 64)"><rect x="-11" y="-3.5" width="22" height="7" rx="3.5" fill="#fff"/>' +
      '<circle cx="-12" cy="-3" r="3.6" fill="#fff"/><circle cx="-12" cy="3" r="3.6" fill="#fff"/><circle cx="12" cy="-3" r="3.6" fill="#fff"/><circle cx="12" cy="3" r="3.6" fill="#fff"/>' +
      '<rect x="-10" y="-2" width="20" height="4" fill="#fff" stroke="none"/></g>',
  ),
  // Caja de juguetes: caja de madera con pelota y peluche asomando
  furn_ball: wrap(
    '<ellipse cx="50" cy="94" rx="38" ry="5" fill="rgba(0,0,0,0.12)" stroke="none"/>' +
      '<circle cx="36" cy="44" r="13" fill="#ff6b6b"/><path d="M27 35 C33 41 33 48 27 53" fill="none" stroke="#fff" stroke-width="3"/>' +
      '<circle cx="62" cy="40" r="10" fill="#c98a52"/><circle cx="54" cy="31" r="4.5" fill="#c98a52"/><circle cx="70" cy="31" r="4.5" fill="#c98a52"/>' +
      '<circle cx="58.5" cy="39" r="1.6" fill="' + K + '" stroke="none"/><circle cx="65.5" cy="39" r="1.6" fill="' + K + '" stroke="none"/>' +
      '<rect x="16" y="50" width="68" height="42" rx="6" fill="#f2b56b"/>' +
      '<path d="M16 64 H84 M16 78 H84" stroke="#d48f45" stroke-width="2.5"/>' +
      '<rect x="40" y="58" width="20" height="12" rx="3" fill="#fff4e0"/>' +
      '<path d="M50 61 C47 59 44 61 46 64 L50 67 L54 64 C56 61 53 59 50 61 Z" fill="#ff6b6b" stroke-width="1.5"/>',
  ),
  // Bañera con patas, espuma y patito
  furn_tub: wrap(
    '<ellipse cx="50" cy="95" rx="40" ry="4" fill="rgba(0,0,0,0.12)" stroke="none"/>' +
      '<path d="M26 86 L22 94 M74 86 L78 94" stroke-width="4"/>' +
      '<circle cx="30" cy="48" r="9" fill="#fff"/><circle cx="44" cy="44" r="11" fill="#fff"/><circle cx="60" cy="45" r="10" fill="#fff"/><circle cx="72" cy="50" r="7" fill="#fff"/>' +
      '<path d="M12 54 H88 L83 80 Q80 88 70 88 H30 Q20 88 17 80 Z" fill="#8fd3ff"/>' +
      '<path d="M12 54 H88" stroke-width="5"/>' +
      '<path d="M22 64 Q50 70 78 64" fill="none" stroke="#c9ecff" stroke-width="3"/>' +
      '<g transform="translate(62 38)"><ellipse cx="0" cy="6" rx="9" ry="6" fill="#ffd23f"/><circle cx="-4" cy="-2" r="5.5" fill="#ffd23f"/><path d="M-10 -2 L-14 0 L-10 1 Z" fill="#ff8a3d" stroke-width="1.5"/><circle cx="-5" cy="-3" r="1.2" fill="' + K + '" stroke="none"/></g>',
  ),
  // Planta en maceta
  furn_plant: wrap(
    '<ellipse cx="50" cy="95" rx="22" ry="4" fill="rgba(0,0,0,0.12)" stroke="none"/>' +
      '<path d="M50 62 C34 56 24 40 30 22 C42 30 50 44 50 62 Z" fill="#6cc56a"/>' +
      '<path d="M50 62 C66 56 76 40 70 22 C58 30 50 44 50 62 Z" fill="#5bb35a"/>' +
      '<path d="M50 62 C44 46 46 26 50 12 C54 26 56 46 50 62 Z" fill="#7fd27c"/>' +
      '<path d="M50 60 V30" stroke="#3f8a3e" stroke-width="2"/>' +
      '<path d="M32 62 H68 L63 92 H37 Z" fill="#e2763b"/>' +
      '<rect x="29" y="58" width="42" height="9" rx="3" fill="#f08a4f"/>',
  ),
  // Tele de dibujos con antenas y una huella en pantalla
  furn_tv: wrap(
    '<ellipse cx="50" cy="95" rx="34" ry="4" fill="rgba(0,0,0,0.12)" stroke="none"/>' +
      '<path d="M40 22 L30 8 M60 22 L70 8"/><circle cx="30" cy="8" r="3" fill="#ff6b6b"/><circle cx="70" cy="8" r="3" fill="#ff6b6b"/>' +
      '<path d="M28 82 L24 94 M72 82 L76 94" stroke-width="4"/>' +
      '<rect x="12" y="22" width="76" height="60" rx="12" fill="#9b6bd6"/>' +
      '<rect x="20" y="30" width="48" height="44" rx="8" fill="#bfe8ff"/>' +
      '<g fill="#6bb8ff" stroke="none"><ellipse cx="44" cy="56" rx="7" ry="6"/><circle cx="36" cy="47" r="3"/><circle cx="42" cy="43" r="3"/><circle cx="48" cy="43" r="3"/><circle cx="53" cy="47" r="3"/></g>' +
      '<path d="M24 36 L30 34" stroke="#fff" stroke-width="3"/>' +
      '<circle cx="78" cy="40" r="4" fill="#ffd23f"/><circle cx="78" cy="54" r="4" fill="#ff8fb5"/>',
  ),
};

/** SVG del mueble (o null si no tiene dibujo propio). */
export function furnitureSVG(id: string): string | null {
  return FURNITURE[id] ?? null;
}
