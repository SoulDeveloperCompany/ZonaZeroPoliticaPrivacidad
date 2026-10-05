/**
 * Definiciones de datos del juego.
 *
 * Equivalen a los ScriptableObjects de Unity: son "assets" de datos
 * (especies, items, competencias, acciones, etapas) separados de la lógica.
 * Para añadir contenido nuevo se crea una definición y se registra en
 * `DataRegistry`; ningún sistema necesita cambiar.
 */
import type {
  AccessorySlot,
  CoatPattern,
  GrowthStage,
  PetStatKey,
  PetStats,
} from '../systems/pet/PetTypes';

export type StatDeltas = Partial<Record<PetStatKey, number>>;

/** Truco que una especie puede aprender. */
export interface TrickDefinition {
  id: string;
  name: string;
  icon: string;
}

/** "ScriptableObject" de especie. */
export interface SpeciesDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Colores principales posibles al nacer. */
  primaryPalette: string[];
  /** Colores secundarios (manchas, panza, caparazón...). */
  secondaryPalette: string[];
  patterns: CoatPattern[];
  /** Stats base de agilidad y belleza de la especie (se heredan con variación). */
  baseAgility: number;
  baseBeauty: number;
  /** Multiplicadores de degradación (1 = normal). */
  decayModifiers?: Partial<Record<'hunger' | 'happiness' | 'energy' | 'hygiene', number>>;
  /** Comidas favoritas (dan felicidad extra). */
  favoriteFoods: string[];
  tricks: TrickDefinition[];
  /** Nombres sugeridos al nacer. */
  nameSuggestions: string[];
}

export type ItemCategory = 'food' | 'accessory' | 'furniture' | 'accelerator' | 'medicine' | 'special';

export interface Price {
  coins?: number;
  stars?: number;
}

/** Bonus pasivos de los muebles colocados en casa. */
export interface FurnitureBonus {
  /** Multiplica la energía recuperada al dormir. */
  sleepEnergy?: number;
  /** Multiplica la felicidad ganada al jugar. */
  playHappiness?: number;
  /** Multiplica la higiene ganada al bañar. */
  bathHygiene?: number;
  /** Multiplica la pérdida de felicidad con el tiempo (<1 = más lenta). */
  happinessDecay?: number;
}

/** "ScriptableObject" de item. */
export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  icon: string;
  price: Price;
  /** Efecto inmediato al usarlo (comida, medicina). */
  effects?: StatDeltas;
  /** Accesorios: hueco y bonus de belleza mientras está equipado. */
  slot?: AccessorySlot;
  beautyBonus?: number;
  /** Muebles. */
  furniture?: FurnitureBonus;
  /** Aceleradores: días de juego que suma al instante. */
  growthDays?: number;
  /** Aceleradores: duración (ms reales) del crecimiento x2. */
  growthBoostMs?: number;
  /** Recupera al instante a una mascota escapada. */
  rescuesPet?: boolean;
  /** Etapa mínima para poder usarlo. */
  minStage?: GrowthStage;
  /** Comida gratis e infinita (para que nunca te quedes sin poder alimentar). */
  free?: boolean;
}

export type MinigameType = 'agility' | 'beauty' | 'tricks';

/** "ScriptableObject" de competencia. */
export interface CompetitionDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  minigame: MinigameType;
  /** Peso de cada stat en la nota (la suma de pesos + minigameWeight debe ser 1). `tricks` = nº de trucos. */
  statWeights: Partial<Record<PetStatKey | 'tricks', number>>;
  minigameWeight: number;
  energyCost: number;
  entryFee: Price;
  cooldownMs: number;
  /** Nota mínima (0-100) para 2, 3, 4 y 5 estrellas. */
  ratingThresholds: [number, number, number, number];
  /** Recompensas por calificación (índice 0 = 1 estrella). */
  rewards: { coins: number[]; stars: number[] };
}

/** Acción de cuidado (alimentar, jugar...). */
export interface ActionDefinition {
  id: string;
  name: string;
  icon: string;
  effects: StatDeltas;
  /** Energía mínima necesaria. */
  minEnergy: number;
  cooldownMs: number;
  minStage: GrowthStage;
  /** Clase de animación CSS que reproduce la UI. */
  animation: string;
  /** Mensajes de feedback aleatorios. */
  messages: string[];
}

/** Etapa de crecimiento. */
export interface StageDefinition {
  id: GrowthStage;
  name: string;
  /** Día de juego en que empieza. */
  startDay: number;
  /** Escala visual del sprite. */
  scale: number;
  /** Tope de agilidad y belleza en esta etapa. */
  statCap: number;
  /** Funciones que se desbloquean (acciones, pantallas). */
  unlocks: string[];
  description: string;
}

export type { PetStats };
