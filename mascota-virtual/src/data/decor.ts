/**
 * Decoración de la casa (Auditoría P10): temas de pared, suelo y alfombra.
 * Es el gran destino de las monedas a medio plazo (~11.000 🪙 + 40 ⭐ en total):
 * unas 3 semanas para un jugador activo (~700 🪙/día) y ~6 para uno casual.
 * Colores: pared [base, raya, punto1, punto2, zócalo] · suelo [tabla, tabla2, línea] · alfombra [borde, centro, costura].
 */
import type { ItemDefinition } from './types';

export type DecorSlot = 'pared' | 'suelo' | 'alfombra';

/** Lo que tiene toda casa al empezar (gratis, no se vende). */
export const DEFAULT_DECOR: Record<DecorSlot, string> = { pared: 'pared_clasica', suelo: 'suelo_madera', alfombra: 'alfombra_rosa' };

const d = (id: string, name: string, icon: string, slot: DecorSlot, price: ItemDefinition['price'], colors: string[], description: string): ItemDefinition => ({
  id, name, icon, description, category: 'decor', price, decor: { slot, colors },
});

export const DECOR_ITEMS: ItemDefinition[] = [
  // Pared
  d('pared_clasica', 'Papel melocotón', '🟧', 'pared', {}, ['#ffe7cc', '#ffdfbf', '#ffc69a', '#ffb8b8', '#f0b98a'], 'El papel de siempre: cálido y alegre.'),
  d('pared_menta', 'Papel menta', '🟩', 'pared', { coins: 400 }, ['#e3f6ec', '#d4f0e2', '#9ad9b8', '#ffd6a5', '#a8dcc2'], 'Fresco y tranquilo.'),
  d('pared_cielo', 'Papel cielo', '🟦', 'pared', { coins: 600 }, ['#e3f1ff', '#d3e8ff', '#9cc9ff', '#ffffff', '#9fc3ea'], 'Como dormir entre nubes.'),
  d('pared_lavanda', 'Papel lavanda', '🟪', 'pared', { coins: 800 }, ['#efe6ff', '#e5d9ff', '#c4a8ff', '#ffc2e0', '#c9b3ef'], 'Suave y elegante.'),
  d('pared_rayas', 'Rayas de caramelo', '🍬', 'pared', { coins: 1200 }, ['#fff0f4', '#ffd6e2', '#ff9eb8', '#ffe08a', '#f5a9bf'], 'Dulce como un pastelito.'),
  d('pared_bosque', 'Bosque encantado', '🌲', 'pared', { coins: 1600 }, ['#e6f2d9', '#d7eac4', '#7fbf6a', '#f7d77a', '#9cc483'], 'Hojas y luz de sol.'),
  d('pared_galaxia', 'Galaxia', '🌌', 'pared', { stars: 12 }, ['#2b2f6b', '#353a7d', '#ffe98a', '#b9c4ff', '#4a4f96'], 'Estrellas de día y de noche. Muy especial.'),
  d('pared_castillo', 'Castillo real', '🏰', 'pared', { stars: 20 }, ['#f4ead7', '#ebdcc0', '#d4af37', '#c0392b', '#c9a86a'], 'Para la realeza de los concursos.'),
  // Suelo
  d('suelo_madera', 'Madera cálida', '🟫', 'suelo', {}, ['#d9a066', '#d39858', '#b97c43'], 'Tablas de madera de toda la vida.'),
  d('suelo_roble', 'Roble claro', '🪵', 'suelo', { coins: 400 }, ['#ead2a8', '#e2c696', '#c9a56d'], 'Luminoso y acogedor.'),
  d('suelo_baldosas', 'Baldosas', '⬜', 'suelo', { coins: 700 }, ['#f2f2f2', '#e4e4e4', '#c9c9c9'], 'Limpio y brillante.'),
  d('suelo_cesped', 'Césped', '🌱', 'suelo', { coins: 1000 }, ['#8fd17a', '#84c76f', '#6fb35b'], '¡Como jugar en el jardín!'),
  d('suelo_nube', 'Nube', '☁️', 'suelo', { coins: 1500 }, ['#f7fbff', '#eaf3ff', '#cfe2f7'], 'Blandito, blandito.'),
  // Alfombra
  d('alfombra_rosa', 'Alfombra rosa', '🩷', 'alfombra', {}, ['#ff9f9f', '#ffb7b0', '#ffe0d6'], 'La alfombra favorita para la siesta.'),
  d('alfombra_azul', 'Alfombra azul', '💙', 'alfombra', { coins: 300 }, ['#8cc4ff', '#b5d9ff', '#e2f0ff'], 'Fresquita.'),
  d('alfombra_verde', 'Alfombra verde', '💚', 'alfombra', { coins: 450 }, ['#9ad9a0', '#bde8c1', '#e3f7e5'], 'Como un prado.'),
  d('alfombra_arcoiris', 'Alfombra arcoíris', '🌈', 'alfombra', { coins: 900 }, ['#ffb86b', '#b9a3ff', '#ffe08a'], 'Todos los colores juntos.'),
  d('alfombra_huellas', 'Alfombra de huellas', '🐾', 'alfombra', { coins: 1200 }, ['#c9a27a', '#e3c7a5', '#7a5a3a'], 'Con huellitas por todas partes.'),
  d('alfombra_dorada', 'Alfombra dorada', '👑', 'alfombra', { stars: 8 }, ['#e9c46a', '#f4d98c', '#fff3c4'], 'Para campeones.'),
];
