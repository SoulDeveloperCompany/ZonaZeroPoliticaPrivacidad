/**
 * GameState (Singleton): contiene TODO el estado serializable de la partida.
 * Los sistemas leen y escriben aquí; el SaveSystem lo convierte a JSON.
 */
import { GameConfig } from './GameConfig';
import type { PetData } from '../systems/pet/PetTypes';
import type { MemoryEntry } from '../systems/save/AlbumSystem';
import type { MissionProgress } from '../systems/games/MissionSystem';

export const SAVE_VERSION = 1;

export interface GameData {
  version: number;
  createdAt: number;
  lastSavedAt: number;
  wallet: { coins: number; stars: number };
  /** itemId -> cantidad. */
  inventory: Record<string, number>;
  /** Muebles comprados (colocados en casa). */
  furniture: string[];
  pets: PetData[];
  activePetId: string | null;
  album: MemoryEntry[];
  daily: { lastClaimDay: string | null; streak: number };
  /** "petId:competitionId" -> ms en que se puede volver a competir. */
  competitionCooldowns: Record<string, number>;
  counters: { actions: number; competitions: number; births: number; rescues: number };
  tutorialDone: boolean;
  /** Récord por minijuego. */
  gameRecords: Record<string, number>;
  /** Monedas ganadas hoy por minijuego (tope diario). */
  gamesToday: { day: string; coins: Record<string, number> };
  /** Misiones diarias. */
  missions: { day: string; list: MissionProgress[]; bonusClaimed: boolean };
  /** Identidad para el servidor (como en Mi Zoológico). */
  player: { id: string; apodo: string };
  online: { url: string; lastSync: number };
}

export function createEmptyGameData(now: number): GameData {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastSavedAt: now,
    wallet: { coins: GameConfig.STARTING_COINS, stars: GameConfig.STARTING_STARS },
    inventory: { food_milk: 3, food_kibble: 2 },
    furniture: [],
    pets: [],
    activePetId: null,
    album: [],
    daily: { lastClaimDay: null, streak: 0 },
    competitionCooldowns: {},
    counters: { actions: 0, competitions: 0, births: 0, rescues: 0 },
    tutorialDone: false,
    gameRecords: {},
    gamesToday: { day: '', coins: {} },
    missions: { day: '', list: [], bonusClaimed: false },
    player: { id: '', apodo: '' },
    online: { url: '', lastSync: 0 },
  };
}

export class GameState {
  private static _instance: GameState | null = null;

  static get instance(): GameState {
    if (!this._instance) this._instance = new GameState();
    return this._instance;
  }

  data: GameData = createEmptyGameData(Date.now());

  /** Reemplaza el estado completo (al cargar partida o en tests). */
  load(data: GameData): void {
    this.data = data;
  }

  reset(now: number): void {
    this.data = createEmptyGameData(now);
  }
}
