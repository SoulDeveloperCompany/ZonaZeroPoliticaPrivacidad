/**
 * Nombres para la opción "aleatorio". Combina los sugeridos por la especie
 * con una lista general. Para añadir nombres basta con ampliar la lista.
 */
import { pick } from '../core/random';
import { DataRegistry } from './DataRegistry';

export const GENERAL_NAMES = [
  'Chispa', 'Nube', 'Galleta', 'Bombón', 'Canela', 'Pipo', 'Lulú', 'Tofu', 'Mochi', 'Churro',
  'Pelusa', 'Fideo', 'Kiwi', 'Coco', 'Maní', 'Brownie', 'Panchito', 'Luna', 'Sol', 'Trufa',
  'Rayo', 'Bigotes', 'Pompón', 'Wafle', 'Arepa', 'Tamal', 'Cocada', 'Bolita', 'Pancho', 'Chocolate',
];

/** Nombre aleatorio para una especie (evita repetir `avoid` si es posible). */
export function randomName(speciesId?: string, avoid?: string): string {
  const pool = [...GENERAL_NAMES];
  if (speciesId) pool.push(...DataRegistry.instance.getSpecies(speciesId).nameSuggestions);
  const options = pool.filter((n) => n !== avoid);
  return pick(options.length ? options : pool);
}
