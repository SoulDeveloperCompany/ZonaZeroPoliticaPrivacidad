/**
 * Tipos base del Sistema de Mascota: especies, sexo, etapas y stats.
 */

/**
 * Especies incluidas de serie. La lógica trabaja con `speciesId: string`
 * para que se puedan registrar especies nuevas sin tocar este enum
 * (ver `src/data/species.ts`).
 */
export enum Species {
  Dog = 'dog',
  Cat = 'cat',
  Rabbit = 'rabbit',
  Parrot = 'parrot',
  Turtle = 'turtle',
  Hamster = 'hamster',
}

export enum Sex {
  Male = 'male',
  Female = 'female',
}

/** Etapas de crecimiento (el orden importa: de menor a mayor). */
export enum GrowthStage {
  Baby = 'baby',
  Puppy = 'puppy', // "Cachorro"
  Juvenile = 'juvenile',
  Adult = 'adult',
  Senior = 'senior',
}

export const STAGE_ORDER: GrowthStage[] = [
  GrowthStage.Baby,
  GrowthStage.Puppy,
  GrowthStage.Juvenile,
  GrowthStage.Adult,
  GrowthStage.Senior,
];

/** Todos los stats van de 0 a 100. OJO: en `hunger` 100 = muerto de hambre. */
export interface PetStats {
  happiness: number;
  hunger: number;
  energy: number;
  health: number;
  hygiene: number;
  agility: number;
  beauty: number;
}

export type PetStatKey = keyof PetStats;

export const STAT_KEYS: PetStatKey[] = [
  'happiness',
  'hunger',
  'energy',
  'health',
  'hygiene',
  'agility',
  'beauty',
];

export const STAT_LABELS: Record<PetStatKey, string> = {
  happiness: 'Felicidad',
  hunger: 'Hambre',
  energy: 'Energía',
  health: 'Salud',
  hygiene: 'Higiene',
  agility: 'Agilidad',
  beauty: 'Belleza',
};

/** Dónde está la mascota. */
export enum PetLocation {
  Active = 'active', // en casa, se puede cuidar
  Ranch = 'ranch', // en el rancho: congelada, no se degrada
  Escaped = 'escaped', // se escapó (salud 0): 48 h para recuperarla
  Adoption = 'adoption', // publicada en adopción
}

/** Patrón del pelaje / plumaje / caparazón. */
export type CoatPattern = 'plain' | 'spots' | 'stripes' | 'patch';

/** Rasgos heredables. */
export interface PetGenes {
  primaryColor: string;
  secondaryColor: string;
  pattern: CoatPattern;
  /** Multiplicador de tamaño (0.85 - 1.15). */
  size: number;
  /** Stats base heredables que marcan el mínimo/potencial. */
  baseAgility: number;
  baseBeauty: number;
}

/** Hueco donde se equipa un accesorio. */
export type AccessorySlot = 'head' | 'face' | 'neck';

/** Estado serializable de una mascota (lo que se guarda en JSON). */
export interface PetData {
  id: string;
  name: string;
  speciesId: string;
  sex: Sex;
  /** Momento de nacimiento (ms reales). */
  bornAt: number;
  /** Edad en días de juego (acumulada, incluye aceleradores). */
  ageDays: number;
  stage: GrowthStage;
  stats: PetStats;
  genes: PetGenes;
  location: PetLocation;
  sleeping: boolean;

  /** Cuidado acumulado en etapas tempranas (media ponderada). */
  care: { sum: number; weight: number };
  /** Se decide al llegar a adulto: ¿recibió el bonus de buen cuidado? */
  wellCared: boolean | null;

  /** Escape. */
  escapedAt: number | null;
  rescueAttempts: number;
  lastSearchAt: number | null;

  /** Accesorios equipados por hueco. */
  equipped: Partial<Record<AccessorySlot, string>>;

  /** Trucos aprendidos y progreso del que se está entrenando (0-100). */
  tricks: string[];
  trickProgress: number;

  /** Cooldowns de acciones: actionId -> ms real en que vuelve a estar disponible. */
  cooldowns: Record<string, number>;

  /** Acelerador de crecimiento activo hasta (ms reales). */
  growthBoostUntil: number | null;

  /** Crianza. */
  generation: number;
  parents: [string, string] | null;
  lastBredAtDay: number | null;

  /** Adopción pública: cuándo se publicó. */
  listedAt: number | null;

  /** Estadísticas de competición. */
  competitions: number;
  bestRating: number;
}
