/**
 * GamesSystem (Singleton): minijuegos de "Jugar".
 * Valida si se puede jugar (etapa, energía, sueño), entrega recompensas con
 * tope diario de monedas y guarda récords.
 */
import { Clock } from '../../core/Clock';
import { EventBus } from '../../core/EventBus';
import { GameState } from '../../core/GameState';
import { PLAY_GAMES, type PlayGameDefinition } from '../../data/games';
import type { StatDeltas } from '../../data/types';
import { EconomySystem } from '../economy/EconomySystem';
import { PetManager } from '../pet/PetManager';
import type { Pet } from '../pet/Pet';
import { STAGE_ORDER } from '../pet/PetTypes';

export type PlayCheck = { ok: true } | { ok: false; reason: 'stage' | 'energy' | 'sleeping' | 'notHome' };

export interface PlayResult {
  score: number;
  coins: number;
  capped: boolean;
  deltas: StatDeltas;
  record: boolean;
}

export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export class GamesSystem {
  private static _instance: GamesSystem | null = null;

  static get instance(): GamesSystem {
    if (!this._instance) this._instance = new GamesSystem();
    return this._instance;
  }

  list(): PlayGameDefinition[] {
    return PLAY_GAMES;
  }

  get(id: string): PlayGameDefinition {
    const g = PLAY_GAMES.find((x) => x.id === id);
    if (!g) throw new Error(`Juego desconocido: ${id}`);
    return g;
  }

  isUnlocked(pet: Pet, game: PlayGameDefinition): boolean {
    return STAGE_ORDER.indexOf(pet.stage) >= STAGE_ORDER.indexOf(game.minStage);
  }

  canPlay(pet: Pet, gameId: string): PlayCheck {
    const game = this.get(gameId);
    if (!pet.isActive) return { ok: false, reason: 'notHome' };
    if (!this.isUnlocked(pet, game)) return { ok: false, reason: 'stage' };
    if (pet.data.sleeping) return { ok: false, reason: 'sleeping' };
    if (pet.stats.energy < game.energyCost) return { ok: false, reason: 'energy' };
    return { ok: true };
  }

  record(gameId: string): number {
    return GameState.instance.data.gameRecords[gameId] ?? 0;
  }

  /** Monedas ganadas hoy en un juego (para el tope diario). */
  coinsToday(gameId: string): number {
    const g = GameState.instance.data.gamesToday;
    return g.day === dayKey(Clock.now()) ? (g.coins[gameId] ?? 0) : 0;
  }

  /** Termina una partida: cobra energía, aplica efectos y monedas (con tope diario). */
  finish(petId: string, gameId: string, score: number): PlayResult {
    const pet = PetManager.instance.get(petId);
    if (!pet) throw new Error('Mascota no encontrada');
    const game = this.get(gameId);
    const state = GameState.instance.data;
    score = Math.max(0, Math.round(score));

    pet.modifyStat('energy', -game.energyCost);
    const deltas = pet.applyDeltas(game.effects(score));
    // El ensayo de trucos adelanta el truco que se está aprendiendo (se completa entrenando)
    if (gameId === 'tricks' && pet.data.tricks.length < pet.species.tricks.length) {
      pet.data.trickProgress = Math.min(99, pet.data.trickProgress + score);
    }

    const today = dayKey(Clock.now());
    if (state.gamesToday.day !== today) state.gamesToday = { day: today, coins: {} };
    const earned = this.coinsToday(gameId);
    const wanted = game.coins(score);
    const coins = Math.max(0, Math.min(wanted, game.dailyCoinCap - earned));
    state.gamesToday.coins[gameId] = earned + coins;
    if (coins) EconomySystem.instance.addCoins(coins);

    const record = score > this.record(gameId);
    if (record) state.gameRecords[gameId] = score;

    EventBus.instance.emit('game:finished', { petId, gameId, score });
    EventBus.instance.emit('pet:statsChanged', { petId });
    return { score, coins, capped: coins < wanted, deltas, record };
  }
}
