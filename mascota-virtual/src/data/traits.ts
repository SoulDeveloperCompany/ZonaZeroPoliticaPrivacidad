/**
 * Rasgos de personalidad (Auditoría P8). Cada mascota tiene 2 al nacer.
 * Cambian un poco cómo se comporta y cómo responde a los cuidados; los efectos son pequeños
 * a propósito: dan carácter, no ventajas decisivas.
 */
import type { PetStatKey } from '../systems/pet/PetTypes';

export interface TraitDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Multiplicadores de la degradación de necesidades. */
  decay?: Partial<Record<'hunger' | 'happiness' | 'energy' | 'hygiene', number>>;
  /** Bonus extra al hacer ciertas acciones. */
  actionBonus?: Record<string, Partial<Record<PetStatKey, number>>>;
  /** Multiplicador de lo que sube el vínculo. */
  bondMul?: number;
  /** Comportamientos en reposo que prefiere (ver HomeScreen.idleBehavior). */
  idle?: string[];
}

export const TRAITS: TraitDefinition[] = [
  { id: 'gloton', name: 'Glotón', icon: '🍪', description: 'Siempre tiene hambre y disfruta mucho cada comida.', decay: { hunger: 1.15 }, actionBonus: { feed: { happiness: 3 } }, idle: ['bowl'] },
  { id: 'dormilon', name: 'Dormilón', icon: '😴', description: 'Se cansa antes y le encantan las siestas.', decay: { energy: 1.12 }, idle: ['yawn'] },
  { id: 'jugueton', name: 'Juguetón', icon: '🎾', description: 'Juega con más ganas y te trae la pelota.', actionBonus: { play: { happiness: 4 } }, idle: ['ball'] },
  { id: 'timido', name: 'Tímido', icon: '🙈', description: 'Le cuesta confiar, pero cuando lo hace es muy cariñoso.', bondMul: 0.75, idle: ['peek'] },
  { id: 'curioso', name: 'Curioso', icon: '🔍', description: 'Todo lo investiga; aprende más en los paseos.', actionBonus: { walk: { agility: 1 } }, idle: ['sniff', 'look'] },
  { id: 'carinoso', name: 'Cariñoso', icon: '💕', description: 'Le encantan los mimos y se encariña rápido.', bondMul: 1.25, actionBonus: { pet: { happiness: 2 } }, idle: ['love'] },
  { id: 'presumido', name: 'Presumido', icon: '✨', description: 'Le gusta lucirse; los baños le sientan genial.', actionBonus: { bathe: { beauty: 1 } }, idle: ['pose'] },
];

export function getTrait(id: string): TraitDefinition | undefined {
  return TRAITS.find((t) => t.id === id);
}
