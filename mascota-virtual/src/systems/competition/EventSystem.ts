/**
 * EventSystem (Singleton): competencias entre mascotas.
 *
 * Flujo:
 *   1. `canEnter()` valida (solo adultos/senior, energía, cooldown, inscripción).
 *   2. `start()` cobra inscripción y energía y devuelve una sesión.
 *   3. La UI ejecuta el minijuego y obtiene un rendimiento 0..1.
 *   4. `finish()` calcula la nota (stats + minijuego), la calificación 1-5
 *      estrellas y entrega recompensas. El ranking global lo da el servidor.
 *
 * (Se llama EventSystem como en el diseño original; no confundir con EventBus.)
 */
import { Clock } from '../../core/Clock';
import { EventBus } from '../../core/EventBus';
import { GameState } from '../../core/GameState';
import { clamp, randRange } from '../../core/random';
import { DataRegistry } from '../../data/DataRegistry';
import { Feature } from '../../data/stages';
import type { CompetitionDefinition } from '../../data/types';
import { EconomySystem } from '../economy/EconomySystem';
import { GrowthSystem } from '../growth/GrowthSystem';
import { PetManager } from '../pet/PetManager';
import type { Pet } from '../pet/Pet';
import { AlbumSystem } from '../save/AlbumSystem';

export type EnterCheck =
  | { ok: true }
  | { ok: false; reason: 'stage' | 'energy' | 'cooldown' | 'funds' | 'sleeping' | 'notHome'; remainingMs?: number };

export interface CompetitionSession {
  petId: string;
  competitionId: string;
  startedAt: number;
}

export interface CompetitionResult {
  score: number;
  statScore: number;
  minigameScore: number;
  rating: number; // 1..5
  coins: number;
  stars: number;
}

export class EventSystem {
  private static _instance: EventSystem | null = null;

  static get instance(): EventSystem {
    if (!this._instance) this._instance = new EventSystem();
    return this._instance;
  }

  list(): CompetitionDefinition[] {
    return DataRegistry.instance.allCompetitions();
  }

  private cooldownKey(petId: string, compId: string): string {
    return `${petId}:${compId}`;
  }

  cooldownRemaining(petId: string, compId: string, now = Clock.now()): number {
    const until = GameState.instance.data.competitionCooldowns[this.cooldownKey(petId, compId)] ?? 0;
    return Math.max(0, until - now);
  }

  canEnter(pet: Pet, compId: string): EnterCheck {
    const comp = DataRegistry.instance.getCompetition(compId);
    if (!pet.isActive) return { ok: false, reason: 'notHome' };
    // Solo mascotas adultas (y senior) pueden competir
    if (!GrowthSystem.instance.isUnlocked(pet, Feature.Compete)) return { ok: false, reason: 'stage' };
    if (pet.data.sleeping) return { ok: false, reason: 'sleeping' };
    if (pet.stats.energy < comp.energyCost) return { ok: false, reason: 'energy' };
    const remaining = this.cooldownRemaining(pet.id, compId);
    if (remaining > 0) return { ok: false, reason: 'cooldown', remainingMs: remaining };
    if (!EconomySystem.instance.canAfford(comp.entryFee)) return { ok: false, reason: 'funds' };
    return { ok: true };
  }

  /** Inscribe a la mascota: cobra la inscripción y la energía. */
  start(petId: string, compId: string): CompetitionSession | EnterCheck {
    const pet = PetManager.instance.get(petId);
    if (!pet) return { ok: false, reason: 'notHome' };
    const check = this.canEnter(pet, compId);
    if (!check.ok) return check;
    const comp = DataRegistry.instance.getCompetition(compId);
    EconomySystem.instance.pay(comp.entryFee);
    pet.modifyStat('energy', -comp.energyCost);
    return { petId, competitionId: compId, startedAt: Clock.now() };
  }

  /** Nota por stats (0-100) según los pesos de la competencia. */
  statScore(pet: Pet, comp: CompetitionDefinition): number {
    let total = 0;
    let weights = 0;
    for (const [key, weight] of Object.entries(comp.statWeights)) {
      if (!weight) continue;
      let value: number;
      if (key === 'tricks') {
        value = (pet.data.tricks.length / Math.max(1, pet.species.tricks.length)) * 100;
      } else if (key === 'beauty') {
        value = pet.effectiveBeauty; // incluye accesorios
      } else {
        value = pet.stats[key as keyof typeof pet.stats];
      }
      total += value * weight;
      weights += weight;
    }
    return weights > 0 ? total / weights : 0;
  }

  /** Convierte una nota 0-100 en calificación 1-5 estrellas. */
  rating(score: number, comp: CompetitionDefinition): number {
    let stars = 1;
    comp.ratingThresholds.forEach((t) => {
      if (score >= t) stars++;
    });
    return stars;
  }

  /**
   * Termina la competencia.
   * @param minigame rendimiento del jugador en el minijuego, de 0 a 1
   */
  finish(session: CompetitionSession, minigame: number): CompetitionResult {
    const pet = PetManager.instance.get(session.petId);
    if (!pet) throw new Error('Mascota no encontrada');
    const comp = DataRegistry.instance.getCompetition(session.competitionId);

    const statPart = this.statScore(pet, comp);
    const gamePart = clamp(minigame, 0, 1) * 100;
    const statWeight = 1 - comp.minigameWeight;
    // Un poco de suerte (±3) para que cada participación sea distinta
    const score = clamp(statPart * statWeight + gamePart * comp.minigameWeight + randRange(-3, 3));
    const rating = this.rating(score, comp);
    const coins = comp.rewards.coins[rating - 1] ?? 0;
    const stars = comp.rewards.stars[rating - 1] ?? 0;

    EconomySystem.instance.addCoins(coins);
    if (stars) EconomySystem.instance.addStars(stars);

    // Efectos sobre la mascota
    pet.modifyStat('happiness', rating >= 3 ? 10 : -5);
    pet.modifyStat('hunger', 8);
    if (comp.minigame === 'agility') pet.modifyStat('agility', rating >= 3 ? 1 : 0.5);

    const state = GameState.instance.data;
    state.competitionCooldowns[this.cooldownKey(pet.id, comp.id)] = Clock.now() + comp.cooldownMs;
    state.counters.competitions++;
    pet.data.competitions++;

    // Primer 5 estrellas o mejor marca: se guarda en el álbum
    if (rating > pet.data.bestRating) {
      pet.data.bestRating = rating;
      if (rating >= 4) {
        AlbumSystem.instance.add(
          pet,
          'competition',
          `${'⭐'.repeat(rating)} en ${comp.name}`,
          `${pet.name} consiguió ${rating} estrellas con ${Math.round(score)} puntos.`,
        );
      }
    }


    EventBus.instance.emit('competition:finished', {
      petId: pet.id,
      competitionId: comp.id,
      score,
      rating,
      coins,
      stars,
    });
    EventBus.instance.emit('pet:statsChanged', { petId: pet.id });

    return { score, statScore: statPart, minigameScore: gamePart, rating, coins, stars };
  }

}
