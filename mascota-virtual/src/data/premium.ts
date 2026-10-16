/**
 * Contenido de pago (compras de Google Play) y eventos de temporada.
 *
 * Principios (docs/AUDITORIA-2026-10.md, sección 6): todo lo de pago es COSMÉTICO u opcional,
 * nada da ventaja en competencias ni salta el cuidado. El juego completo es gratis y sin anuncios.
 *
 * Los ids de producto (PRODUCTS[].id) deben existir en Play Console › Monetizar › Productos integrados
 * en la aplicación, como productos de compra única (no consumibles). Ver play-store/FICHA.md.
 */
import type { ItemDefinition } from './types';

export interface ProductDefinition {
  /** Id del producto en Google Play. */
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Objetos que desbloquea (accesorios y decoración marcados con `premium`). */
  items: string[];
  /** Estrellas de regalo al comprarlo (una vez). */
  stars?: number;
  /** Precio orientativo para la web (en Android se muestra el real de Google Play). */
  priceHint: string;
}

export const PRODUCTS: ProductDefinition[] = [
  {
    id: 'patitas_fundador',
    name: 'Paquete Fundador',
    icon: '🌟',
    description: 'Corona de fundador, 2 temas exclusivos (Aurora y Alfombra real), 30 ⭐ y la insignia 🌟 Fundador. ¡Ayudas a que Patitas siga creciendo!',
    items: ['acc_founder', 'pared_aurora', 'alfombra_real'],
    stars: 30,
    priceHint: '2,99 €',
  },
  {
    id: 'patitas_deco_premium',
    name: 'Colección Deco Premium',
    icon: '🏡',
    description: '6 temas exclusivos para tu casa: Océano, Arena, Dulcería, Algodón de azúcar, Sakura y Tatami.',
    items: ['pared_oceano', 'suelo_arena', 'pared_dulceria', 'alfombra_algodon', 'pared_sakura', 'suelo_tatami'],
    priceHint: '1,99 €',
  },
];

// ---------- Eventos de temporada ----------

export interface SeasonalEvent {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Mes-día de inicio y fin (inclusive), se repite cada año. */
  start: string;
  end: string;
}

export const SEASONAL_EVENTS: SeasonalEvent[] = [
  { id: 'halloween', name: 'Noche de Calabazas', icon: '🎃', description: 'Decoración y sombrero de edición limitada. ¡Solo hasta el 3 de noviembre!', start: '10-10', end: '11-03' },
  { id: 'navidad', name: 'Invierno Mágico', icon: '❄️', description: 'Decoración de invierno de edición limitada.', start: '12-10', end: '01-06' },
];

/** ¿Está activo el evento en esta fecha? (maneja eventos que cruzan el año, como Navidad) */
export function isEventActive(ev: SeasonalEvent, now: Date): boolean {
  const md = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return ev.start <= ev.end ? md >= ev.start && md <= ev.end : md >= ev.start || md <= ev.end;
}

const deco = (id: string, name: string, icon: string, slot: 'pared' | 'suelo' | 'alfombra', colors: string[], description: string, extra: Partial<ItemDefinition>): ItemDefinition => ({
  id, name, icon, description, category: 'decor', price: {}, decor: { slot, colors }, ...extra,
});

/** Decoración premium y de temporada (se registra junto al resto en DataRegistry). */
export const PREMIUM_DECOR: ItemDefinition[] = [
  // Paquete Fundador
  deco('pared_aurora', 'Aurora boreal', '🌌', 'pared', ['#1d2b53', '#24346a', '#7ef9ff', '#c39bff', '#3b4d8a'], 'Exclusivo del Paquete Fundador.', { premium: 'patitas_fundador' }),
  deco('alfombra_real', 'Alfombra real', '👑', 'alfombra', ['#9b5de5', '#c19bf0', '#ffd23f'], 'Exclusiva del Paquete Fundador.', { premium: 'patitas_fundador' }),
  // Colección Deco Premium
  deco('pared_oceano', 'Océano', '🌊', 'pared', ['#d8f3ff', '#c4ecff', '#5ec4e8', '#ffffff', '#7fbfd9'], 'De la Colección Deco Premium.', { premium: 'patitas_deco_premium' }),
  deco('suelo_arena', 'Arena de playa', '🏖️', 'suelo', ['#f3dfb6', '#ecd3a1', '#d6b77c'], 'De la Colección Deco Premium.', { premium: 'patitas_deco_premium' }),
  deco('pared_dulceria', 'Dulcería', '🍭', 'pared', ['#fff1f8', '#ffe0f0', '#ff8fc8', '#9be7ff', '#f7a8cf'], 'De la Colección Deco Premium.', { premium: 'patitas_deco_premium' }),
  deco('alfombra_algodon', 'Algodón de azúcar', '🍬', 'alfombra', ['#ffd1e8', '#e8d4ff', '#ffffff'], 'De la Colección Deco Premium.', { premium: 'patitas_deco_premium' }),
  deco('pared_sakura', 'Sakura', '🌸', 'pared', ['#fff4f6', '#ffe6ec', '#ff9fb6', '#a6d49f', '#e7b3bf'], 'De la Colección Deco Premium.', { premium: 'patitas_deco_premium' }),
  deco('suelo_tatami', 'Tatami', '🎋', 'suelo', ['#d9d29a', '#cfc78a', '#a89f5c'], 'De la Colección Deco Premium.', { premium: 'patitas_deco_premium' }),
  // Eventos de temporada (se compran con monedas/estrellas mientras dura el evento)
  deco('pared_halloween', 'Noche de brujas', '🦇', 'pared', ['#3b2a4a', '#45325a', '#ff9b3d', '#9bd17a', '#5a4270'], 'Edición limitada de Halloween.', { event: 'halloween', price: { coins: 900 } }),
  deco('suelo_hojas', 'Hojas de otoño', '🍂', 'suelo', ['#c97b3a', '#b86c2e', '#8a4f20'], 'Edición limitada de Halloween.', { event: 'halloween', price: { coins: 700 } }),
  deco('alfombra_calabaza', 'Alfombra calabaza', '🎃', 'alfombra', ['#ff8c2b', '#ffb15e', '#3b2a1a'], 'Edición limitada de Halloween.', { event: 'halloween', price: { coins: 600 } }),
  deco('pared_nieve', 'Copos de nieve', '❄️', 'pared', ['#eef6ff', '#e0eefc', '#ffffff', '#ff6b6b', '#c5d9ee'], 'Edición limitada de invierno.', { event: 'navidad', price: { coins: 900 } }),
  deco('alfombra_navidad', 'Alfombra navideña', '🎄', 'alfombra', ['#2f8f5b', '#4fb37b', '#ffffff'], 'Edición limitada de invierno.', { event: 'navidad', price: { coins: 600 } }),
];
