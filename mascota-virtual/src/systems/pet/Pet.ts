/**
 * Pet: clase base de la mascota.
 *
 * Envuelve un `PetData` (el estado serializable que se guarda en JSON) y
 * añade la lógica propia de la mascota: modificar stats con límites,
 * degradación con el tiempo, estado de ánimo y cooldowns.
 */
import { GameConfig } from '../../core/GameConfig';
import { clamp, pick, randInt, rng, uid } from '../../core/random';
import { DataRegistry } from '../../data/DataRegistry';
import type { FurnitureBonus, SpeciesDefinition, StatDeltas } from '../../data/types';
import {
  GrowthStage,
  PetLocation,
  Sex,
  type PetData,
  type PetGenes,
  type PetStatKey,
} from './PetTypes';

/** Estado de ánimo, usado por el sprite y la UI. */
export type PetMood = 'happy' | 'normal' | 'sad' | 'hungry' | 'dirty' | 'sick' | 'sleeping' | 'tired';

/** Contexto que afecta a la degradación (muebles, offline...). */
export interface DecayContext {
  furniture: FurnitureBonus;
  offline: boolean;
}

export class Pet {
  constructor(public readonly data: PetData) {}

  // ---------- Creación ----------

  /** Genera los genes de una mascota nueva (sin padres) de una especie. */
  static randomGenes(species: SpeciesDefinition): PetGenes {
    return {
      primaryColor: pick(species.primaryPalette),
      secondaryColor: pick(species.secondaryPalette),
      pattern: pick(species.patterns),
      size: Math.round((0.9 + rng() * 0.2) * 100) / 100,
      baseAgility: clamp(species.baseAgility + randInt(-6, 6)),
      baseBeauty: clamp(species.baseBeauty + randInt(-6, 6)),
    };
  }

  /**
   * Crea una mascota recién nacida (bebé). El sexo es aleatorio si no se indica.
   */
  static create(opts: {
    name: string;
    speciesId: string;
    now: number;
    sex?: Sex;
    genes?: PetGenes;
    generation?: number;
    parents?: [string, string] | null;
  }): Pet {
    const species = DataRegistry.instance.getSpecies(opts.speciesId);
    const genes = opts.genes ?? Pet.randomGenes(species);
    const data: PetData = {
      id: uid('pet'),
      name: opts.name.trim() || pick(species.nameSuggestions),
      speciesId: species.id,
      sex: opts.sex ?? (rng() < 0.5 ? Sex.Male : Sex.Female),
      bornAt: opts.now,
      ageDays: 0,
      stage: GrowthStage.Baby,
      stats: {
        happiness: 80,
        hunger: 30,
        energy: 90,
        health: 100,
        hygiene: 90,
        // Los bebés empiezan con una fracción de su potencial genético
        agility: Math.round(genes.baseAgility * 0.4),
        beauty: Math.round(genes.baseBeauty * 0.5),
      },
      genes,
      location: PetLocation.Active,
      sleeping: false,
      care: { sum: 0, weight: 0 },
      wellCared: null,
      escapedAt: null,
      rescueAttempts: 0,
      lastSearchAt: null,
      equipped: {},
      tricks: [],
      trickProgress: 0,
      cooldowns: {},
      growthBoostUntil: null,
      generation: opts.generation ?? 1,
      parents: opts.parents ?? null,
      lastBredAtDay: null,
      listedAt: null,
      competitions: 0,
      bestRating: 0,
    };
    return new Pet(data);
  }

  // ---------- Accesos rápidos ----------

  get id(): string {
    return this.data.id;
  }
  get name(): string {
    return this.data.name;
  }
  get species(): SpeciesDefinition {
    return DataRegistry.instance.getSpecies(this.data.speciesId);
  }
  get stage(): GrowthStage {
    return this.data.stage;
  }
  get stats() {
    return this.data.stats;
  }
  get isActive(): boolean {
    return this.data.location === PetLocation.Active;
  }
  get isEscaped(): boolean {
    return this.data.location === PetLocation.Escaped;
  }

  /** Tope de agilidad/belleza según la etapa actual. */
  get statCap(): number {
    return DataRegistry.instance.getStage(this.data.stage).statCap;
  }

  /** Belleza con el bonus de accesorios equipados (para concursos). */
  get effectiveBeauty(): number {
    let bonus = 0;
    for (const itemId of Object.values(this.data.equipped)) {
      if (itemId && DataRegistry.instance.hasItem(itemId)) {
        bonus += DataRegistry.instance.getItem(itemId).beautyBonus ?? 0;
      }
    }
    return clamp(this.data.stats.beauty + bonus);
  }

  /** Bienestar general 0-100 (se usa para medir la calidad del cuidado). */
  get wellbeing(): number {
    const s = this.data.stats;
    return (s.happiness + (100 - s.hunger) + s.energy + s.health + s.hygiene) / 5;
  }

  get mood(): PetMood {
    const s = this.data.stats;
    if (this.data.sleeping) return 'sleeping';
    if (s.health < 35) return 'sick';
    if (s.hunger > 75) return 'hungry';
    if (s.hygiene < 25) return 'dirty';
    if (s.energy < 20) return 'tired';
    if (s.happiness < 35) return 'sad';
    if (s.happiness > 70 && s.hunger < 50) return 'happy';
    return 'normal';
  }

  // ---------- Stats ----------

  /** Modifica un stat respetando 0-100 y el tope de etapa. Devuelve el cambio real aplicado. */
  modifyStat(key: PetStatKey, delta: number): number {
    const before = this.data.stats[key];
    let after = before + delta;
    if ((key === 'agility' || key === 'beauty') && delta > 0) {
      // No supera el tope de la etapa, pero tampoco recorta un valor que ya lo superaba (Senior)
      after = Math.min(after, Math.max(this.statCap, before));
    }
    this.data.stats[key] = Math.round(clamp(after) * 100) / 100;
    return this.data.stats[key] - before;
  }

  /** Aplica varios cambios a la vez. Devuelve los cambios reales. */
  applyDeltas(deltas: StatDeltas, multiplier = 1): StatDeltas {
    const applied: StatDeltas = {};
    for (const [key, value] of Object.entries(deltas) as [PetStatKey, number][]) {
      const real = this.modifyStat(key, value * multiplier);
      if (Math.abs(real) >= 0.01) applied[key] = Math.round(real * 10) / 10;
    }
    return applied;
  }

  // ---------- Degradación con el tiempo ----------

  /**
   * Aplica el paso del tiempo a los stats (hambre sube, felicidad baja...).
   * @param days días de juego transcurridos (1 día = 1 hora real)
   */
  simulateDecay(days: number, ctx: DecayContext): void {
    if (!this.isActive || days <= 0) return;
    const cfg = GameConfig;
    const mods = this.species.decayModifiers ?? {};
    const factor = days * (ctx.offline ? cfg.OFFLINE_DECAY_FACTOR : 1);
    const sleepMul = this.data.sleeping ? cfg.SLEEP.decayMultiplier : 1;
    const s = this.data.stats;

    // Los seniors se cansan un poco antes
    const seniorEnergy = this.data.stage === GrowthStage.Senior ? 1.2 : 1;

    s.hunger = clamp(s.hunger + cfg.DECAY_PER_DAY.hunger * (mods.hunger ?? 1) * factor * sleepMul);
    s.happiness = clamp(
      s.happiness +
        cfg.DECAY_PER_DAY.happiness *
          (mods.happiness ?? 1) *
          (ctx.furniture.happinessDecay ?? 1) *
          factor *
          sleepMul,
    );
    s.hygiene = clamp(s.hygiene + cfg.DECAY_PER_DAY.hygiene * (mods.hygiene ?? 1) * factor * sleepMul);

    if (this.data.sleeping) {
      // Dormir recupera energía (la cama ayuda). No usa el factor offline: descansar es bueno.
      s.energy = clamp(s.energy + cfg.SLEEP.energyPerDay * (ctx.furniture.sleepEnergy ?? 1) * days);
      if (s.energy >= cfg.SLEEP.autoWakeEnergy) this.data.sleeping = false;
    } else {
      s.energy = clamp(s.energy + cfg.DECAY_PER_DAY.energy * (mods.energy ?? 1) * seniorEnergy * factor);
      // Si se queda sin energía, se duerme sola
      if (s.energy <= cfg.SLEEP.autoSleepEnergy) this.data.sleeping = true;
    }

    // Salud: baja si está descuidada, se recupera poco a poco si todo va bien
    const h = cfg.HEALTH;
    let healthDelta = 0;
    if (s.hunger >= h.hungerThreshold) healthDelta -= h.hungerDamage;
    if (s.hygiene <= h.hygieneThreshold) healthDelta -= h.hygieneDamage;
    if (s.happiness <= h.happinessThreshold) healthDelta -= h.happinessDamage;
    if (s.energy <= h.energyThreshold) healthDelta -= h.energyDamage;
    if (healthDelta === 0 && s.hunger < 60 && s.hygiene > 40 && s.happiness > 40) {
      healthDelta = h.regenPerDay;
    }
    // El daño usa el factor offline; la regeneración usa los días reales
    s.health = clamp(s.health + healthDelta * (healthDelta < 0 ? factor : days));
  }

  // ---------- Cooldowns ----------

  cooldownRemaining(actionId: string, now: number): number {
    return Math.max(0, (this.data.cooldowns[actionId] ?? 0) - now);
  }

  setCooldown(actionId: string, now: number, durationMs: number): void {
    this.data.cooldowns[actionId] = now + durationMs;
  }
}
