/**
 * GrowthSystem (Singleton): edad, etapas y desbloqueos.
 *
 * - 1 hora real = 1 día de juego (los aceleradores lo duplican o suman días).
 * - Etapas: Bebé (0-3), Cachorro (3-7), Juvenil (7-14), Adulto (14+), Senior (45+).
 * - Mientras es Bebé/Cachorro/Juvenil se mide la calidad del cuidado; si al
 *   hacerse adulto la media es buena, sus stats base suben un 10 %.
 */
import { Clock } from '../../core/Clock';
import { EventBus, toast } from '../../core/EventBus';
import { GameConfig } from '../../core/GameConfig';
import { clamp } from '../../core/random';
import { DataRegistry } from '../../data/DataRegistry';
import type { StageDefinition } from '../../data/types';
import { AlbumSystem } from '../save/AlbumSystem';
import type { Pet } from '../pet/Pet';
import { GrowthStage, STAGE_ORDER } from '../pet/PetTypes';

/** Etapas en las que se mide el cuidado. */
const EARLY_STAGES = new Set([GrowthStage.Baby, GrowthStage.Puppy, GrowthStage.Juvenile]);

export interface StageProgress {
  current: StageDefinition;
  next: StageDefinition | null;
  /** 0..1 de avance hacia la siguiente etapa (1 si no hay más). */
  progress: number;
  /** Días de juego que faltan para la siguiente etapa. */
  daysLeft: number;
}

export class GrowthSystem {
  private static _instance: GrowthSystem | null = null;

  static get instance(): GrowthSystem {
    if (!this._instance) this._instance = new GrowthSystem();
    return this._instance;
  }

  private get stages(): StageDefinition[] {
    return DataRegistry.instance.allStages();
  }

  /** Etapa que corresponde a una edad (en días de juego). */
  stageForAge(ageDays: number): GrowthStage {
    let result = this.stages[0].id;
    for (const s of this.stages) if (ageDays >= s.startDay) result = s.id;
    return result;
  }

  /** Datos para la barra de progreso entre etapas. */
  progress(pet: Pet): StageProgress {
    const list = this.stages;
    const idx = list.findIndex((s) => s.id === pet.stage);
    const current = list[idx];
    const next = list[idx + 1] ?? null;
    if (!next) return { current, next, progress: 1, daysLeft: 0 };
    const span = next.startDay - current.startDay;
    const done = pet.data.ageDays - current.startDay;
    return {
      current,
      next,
      progress: clamp(done / span, 0, 1),
      daysLeft: Math.max(0, next.startDay - pet.data.ageDays),
    };
  }

  /** ¿La etapa actual de la mascota desbloquea esta función? (ver `Feature`) */
  isUnlocked(pet: Pet, feature: string): boolean {
    return DataRegistry.instance.getStage(pet.stage).unlocks.includes(feature);
  }

  /** Primera etapa que desbloquea una función (para mostrar "se desbloquea en..."). */
  unlockStageFor(feature: string): StageDefinition | undefined {
    return this.stages.find((s) => s.unlocks.includes(feature));
  }

  /** Multiplicador de crecimiento actual (aceleradores). */
  growthMultiplier(pet: Pet, now: number): number {
    return pet.data.growthBoostUntil !== null && pet.data.growthBoostUntil > now
      ? GameConfig.GROWTH.boostMultiplier
      : 1;
  }

  /**
   * Avanza la edad de la mascota. Lo llama PetManager en cada paso de simulación.
   * @param days días de juego transcurridos
   */
  advance(pet: Pet, days: number, now: number): void {
    // Registrar la calidad del cuidado en etapas tempranas
    if (EARLY_STAGES.has(pet.stage)) {
      pet.data.care.sum += pet.wellbeing * days;
      pet.data.care.weight += days;
    }
    pet.data.ageDays += days * this.growthMultiplier(pet, now);
    if (pet.data.growthBoostUntil !== null && pet.data.growthBoostUntil <= now) {
      pet.data.growthBoostUntil = null;
    }
    this.checkStage(pet);
  }

  /** Acelerador: suma días de edad al instante. */
  addDays(pet: Pet, days: number): void {
    pet.data.ageDays += days;
    this.checkStage(pet);
  }

  /** Acelerador: crecimiento x2 durante `ms` milisegundos reales (se acumula). */
  addBoost(pet: Pet, ms: number): void {
    const now = Clock.now();
    const from = Math.max(now, pet.data.growthBoostUntil ?? now);
    pet.data.growthBoostUntil = from + ms;
  }

  /** Media de cuidado en etapas tempranas (0-100). */
  careScore(pet: Pet): number {
    return pet.data.care.weight > 0 ? pet.data.care.sum / pet.data.care.weight : pet.wellbeing;
  }

  /** Comprueba si cambió de etapa y aplica las consecuencias. */
  private checkStage(pet: Pet): void {
    const target = this.stageForAge(pet.data.ageDays);
    if (target === pet.stage) return;
    // Puede saltarse varias etapas (offline largo o aceleradores): se recorren en orden
    while (STAGE_ORDER.indexOf(pet.stage) < STAGE_ORDER.indexOf(target)) {
      const from = pet.stage;
      const to = STAGE_ORDER[STAGE_ORDER.indexOf(from) + 1];
      pet.data.stage = to;
      this.onStageReached(pet, from, to);
    }
  }

  private onStageReached(pet: Pet, from: GrowthStage, to: GrowthStage): void {
    const def = DataRegistry.instance.getStage(to);
    AlbumSystem.instance.add(pet, 'stage', `¡Ahora es ${def.name}!`, `${pet.name}: ${def.description}`);

    // Crecimiento natural: agilidad y belleza alcanzan al menos su potencial genético para la etapa
    const potential = Math.min(1, def.statCap / 100);
    pet.stats.agility = Math.max(pet.stats.agility, Math.round(pet.data.genes.baseAgility * potential));
    pet.stats.beauty = Math.max(pet.stats.beauty, Math.round(pet.data.genes.baseBeauty * potential));

    if (to === GrowthStage.Adult) this.applyAdultBonus(pet);

    EventBus.instance.emit('pet:stageChanged', { petId: pet.id, from, to });
    toast(`¡${pet.name} ha crecido! Ahora es ${def.name}.`, 'good');
  }

  /** +10 % a los stats base del adulto si fue bien cuidado de pequeño. */
  private applyAdultBonus(pet: Pet): void {
    const score = this.careScore(pet);
    const cfg = GameConfig.GROWTH;
    pet.data.wellCared = score >= cfg.wellCaredThreshold;
    if (!pet.data.wellCared) return;
    const mul = 1 + cfg.wellCaredBonus;
    const g = pet.data.genes;
    g.baseAgility = clamp(Math.round(g.baseAgility * mul));
    g.baseBeauty = clamp(Math.round(g.baseBeauty * mul));
    pet.stats.agility = clamp(Math.max(pet.stats.agility * mul, g.baseAgility * 0.8));
    pet.stats.beauty = clamp(Math.max(pet.stats.beauty * mul, g.baseBeauty * 0.8));
    AlbumSystem.instance.add(
      pet,
      'wellCared',
      'Criado con amor',
      `Gracias a tus cuidados (${Math.round(score)}/100), ${pet.name} llegó a la edad adulta con +10% en sus stats base.`,
    );
  }
}
