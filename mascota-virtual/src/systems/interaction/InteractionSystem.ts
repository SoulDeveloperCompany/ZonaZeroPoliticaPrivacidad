/**
 * InteractionSystem (Singleton): acciones de cuidado del jugador.
 *
 * alimentar, jugar, acariciar, bañar, entrenar trucos, pasear y dormir.
 * Cada acción modifica stats concretos, tiene cooldown para evitar spam y
 * emite `interaction:performed` para que la UI reproduzca la animación.
 */
import { Clock } from '../../core/Clock';
import { EventBus } from '../../core/EventBus';
import { GameConfig } from '../../core/GameConfig';
import { GameState } from '../../core/GameState';
import { chance, pick, randInt } from '../../core/random';
import { DataRegistry } from '../../data/DataRegistry';
import type { StatDeltas, StageDefinition, TrickDefinition } from '../../data/types';
import { EconomySystem } from '../economy/EconomySystem';
import { getFurnitureBonus } from '../economy/furniture';
import { GrowthSystem } from '../growth/GrowthSystem';
import { PetManager } from '../pet/PetManager';
import type { Pet } from '../pet/Pet';
import { AlbumSystem } from '../save/AlbumSystem';

export type InteractionFailReason =
  | 'invalid'
  | 'notHome'
  | 'locked'
  | 'cooldown'
  | 'sleeping'
  | 'tired'
  | 'noItem'
  | 'notHungry';

export type InteractionResult =
  | { ok: true; deltas: StatDeltas; message: string; coinsFound: number; trickLearned?: TrickDefinition }
  | { ok: false; reason: InteractionFailReason; remainingMs?: number; unlockStage?: StageDefinition };

/** Texto amigable para cada motivo de fallo. */
export function describeFailure(r: Extract<InteractionResult, { ok: false }>): string {
  switch (r.reason) {
    case 'locked':
      return `Se desbloquea en la etapa ${r.unlockStage?.name ?? 'siguiente'}`;
    case 'cooldown':
      return `Espera ${Math.ceil((r.remainingMs ?? 0) / 1000)}s`;
    case 'sleeping':
      return 'Está durmiendo 💤 Si la tocas, se despertará de mal humor';
    case 'tired':
      return 'Le falta energía. ¡Necesita dormir!';
    case 'noItem':
      return 'No tienes ese objeto';
    case 'notHungry':
      return 'No tiene hambre ahora';
    case 'notHome':
      return 'No está en casa';
    default:
      return 'No se puede hacer eso';
  }
}

export class InteractionSystem {
  private static _instance: InteractionSystem | null = null;

  static get instance(): InteractionSystem {
    if (!this._instance) this._instance = new InteractionSystem();
    return this._instance;
  }

  /** Comprueba si una acción se puede hacer ahora (sin ejecutarla). */
  check(pet: Pet, actionId: string, now = Clock.now()): InteractionResult | null {
    const action = DataRegistry.instance.getAction(actionId);
    if (!pet.isActive) return { ok: false, reason: 'notHome' };
    if (!GrowthSystem.instance.isUnlocked(pet, action.id)) {
      return { ok: false, reason: 'locked', unlockStage: GrowthSystem.instance.unlockStageFor(action.id) };
    }
    const remaining = pet.cooldownRemaining(action.id, now);
    if (remaining > 0) return { ok: false, reason: 'cooldown', remainingMs: remaining };
    // Mientras duerme no se puede hacer nada (tocarla la despierta: ver `wakeUp`)
    if (pet.data.sleeping) return { ok: false, reason: 'sleeping' };
    if (pet.stats.energy < action.minEnergy) return { ok: false, reason: 'tired' };
    return null; // todo bien
  }

  /**
   * Ejecuta una acción sobre una mascota.
   * @param opts.itemId comida a usar en `feed` (por defecto la comida básica gratuita)
   */
  perform(petId: string, actionId: string, opts: { itemId?: string } = {}): InteractionResult {
    const pet = PetManager.instance.get(petId);
    if (!pet) return { ok: false, reason: 'invalid' };
    const now = Clock.now();
    const blocked = this.check(pet, actionId, now);
    if (blocked) return blocked;

    const action = DataRegistry.instance.getAction(actionId);
    const furniture = getFurnitureBonus();
    let deltas: StatDeltas = {};
    let message = pick(action.messages);
    let trickLearned: TrickDefinition | undefined;

    switch (action.id) {
      case 'feed': {
        const itemId = opts.itemId ?? 'food_basic';
        const item = DataRegistry.instance.getItem(itemId);
        if (item.category !== 'food') return { ok: false, reason: 'invalid' };
        if (pet.stats.hunger < 15) return { ok: false, reason: 'notHungry' };
        if (!item.free && !EconomySystem.instance.consume(itemId)) return { ok: false, reason: 'noItem' };
        const effects: StatDeltas = { ...(item.effects ?? {}) };
        if (pet.species.favoriteFoods.includes(item.id)) {
          effects.happiness = (effects.happiness ?? 0) + 8;
          message = '¡Su comida favorita! 😍';
        }
        deltas = pet.applyDeltas(effects);
        break;
      }
      case 'play':
        deltas = pet.applyDeltas({
          ...action.effects,
          happiness: (action.effects.happiness ?? 0) * (furniture.playHappiness ?? 1),
        });
        break;
      case 'bathe': {
        // Si ya estaba limpia, tanto baño la resfría
        const cold = pet.stats.hygiene >= GameConfig.COLD.hygieneThreshold;
        deltas = pet.applyDeltas({
          ...action.effects,
          hygiene: (action.effects.hygiene ?? 0) * (furniture.bathHygiene ?? 1),
          ...(cold ? { health: -GameConfig.COLD.healthDamage, happiness: -GameConfig.COLD.happinessDamage } : {}),
        });
        if (cold) message = '🤧 ¡Achís! Se resfrió por tanto baño';
        break;
      }
      case 'train': {
        deltas = pet.applyDeltas(action.effects);
        trickLearned = this.trainTrick(pet);
        message = trickLearned
          ? `¡Aprendió "${trickLearned.name}"! ${trickLearned.icon}`
          : `${message} (${Math.round(pet.data.trickProgress)}%)`;
        break;
      }
      default:
        // Acciones genéricas (incluidas las que se registren en el futuro)
        deltas = pet.applyDeltas(action.effects);
    }

    pet.setCooldown(action.id, now, action.cooldownMs);
    GameState.instance.data.counters.actions++;

    // A veces encuentra monedas
    let coinsFound = 0;
    if (chance(GameConfig.COIN_FIND_CHANCE)) {
      coinsFound = randInt(1, 5);
      EconomySystem.instance.addCoins(coinsFound);
    }

    EventBus.instance.emit('interaction:performed', {
      petId: pet.id,
      actionId: action.id,
      animation: action.animation,
      deltas,
      message,
      coinsFound,
    });
    EventBus.instance.emit('pet:statsChanged', { petId: pet.id });
    return { ok: true, deltas, message, coinsFound, trickLearned };
  }

  /**
   * Despertar a la mascota (al tocarla mientras duerme). Se enfada un poco:
   * pierde felicidad y aguanta despierta un rato antes de volver a dormirse.
   */
  wakeUp(petId: string): boolean {
    const pet = PetManager.instance.get(petId);
    if (!pet || !pet.isActive || !pet.data.sleeping) return false;
    const now = Clock.now();
    pet.data.sleeping = false;
    pet.data.wokenAt = now;
    const deltas = pet.applyDeltas({ happiness: -GameConfig.SLEEP.wakePenalty });
    EventBus.instance.emit('pet:sleepChanged', { petId: pet.id, sleeping: false });
    EventBus.instance.emit('interaction:performed', {
      petId: pet.id,
      actionId: 'wake',
      animation: 'wake',
      deltas,
      message: pick(['😾 ¡Me despertaste!', '😤 ¡Estaba soñando!', '🥱 Grrr... qué sueño']),
    });
    EventBus.instance.emit('pet:statsChanged', { petId: pet.id });
    return true;
  }

  /** Siguiente truco por aprender de la especie (o null si ya los sabe todos). */
  nextTrick(pet: Pet): TrickDefinition | null {
    return pet.species.tricks.find((t) => !pet.data.tricks.includes(t.id)) ?? null;
  }

  /** Suma progreso al truco actual; si llega a 100 lo aprende. */
  private trainTrick(pet: Pet): TrickDefinition | undefined {
    const trick = this.nextTrick(pet);
    if (!trick) {
      // Ya sabe todos: el entrenamiento extra mejora la agilidad
      pet.modifyStat('agility', 1);
      return undefined;
    }
    // Una mascota feliz aprende más rápido
    const gain = 18 + pet.stats.happiness / 10;
    pet.data.trickProgress += gain;
    if (pet.data.trickProgress < 100) return undefined;
    pet.data.trickProgress = 0;
    pet.data.tricks.push(trick.id);
    AlbumSystem.instance.add(pet, 'trick', `Nuevo truco: ${trick.name}`, `${pet.name} aprendió a "${trick.name}".`);
    EventBus.instance.emit('trick:learned', { petId: pet.id, trickId: trick.id });
    return trick;
  }
}
