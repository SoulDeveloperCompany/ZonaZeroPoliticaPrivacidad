/**
 * GameState (Singleton): contiene TODO el estado serializable de la partida.
 * Los sistemas leen y escriben aquí; el SaveSystem lo convierte a JSON.
 */
import { GameConfig } from './GameConfig';
import type { PetData } from '../systems/pet/PetTypes';
import type { MemoryEntry } from '../systems/save/AlbumSystem';
import { DEFAULT_DECOR } from '../data/decor';
import type { Challenge } from '../systems/online/Community';
import type { MissionProgress } from '../systems/games/MissionSystem';

/** 2: la edad pasa a días reales (ver SaveSystem.migrate). */
export const SAVE_VERSION = 2;

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
  /** Decoración puesta y temas comprados (ver data/decor.ts). */
  decor: { pared: string; suelo: string; alfombra: string };
  decorOwned: string[];
  /** Libro de pelajes: colores descubiertos por especie y especies ya premiadas. */
  collection: Record<string, string[]>;
  collectionRewards: string[];
  /** Desafío semanal entre todos (ver systems/online/Community.ts). */
  community: { pending: Record<string, number>; week: string; mine: number; claimed: string[]; last: Challenge | null };
  /** Encuesta de apoyo ya respondida (experimento de monetización, ver ui/Survey.ts). */
  surveyDone: boolean;
  /** Compras de Google Play activas (ids de producto, ver data/premium.ts). */
  entitlements: string[];
  /** Preferencias del jugador (Ajustes). */
  settings: { sound: boolean; haptics: boolean };
  /** Récord por minijuego. */
  gameRecords: Record<string, number>;
  /** Monedas ganadas hoy por minijuego (tope diario). */
  gamesToday: { day: string; coins: Record<string, number> };
  /** Vitaminas de crecimiento usadas hoy (máximo GameConfig.GROWTH.vitaminsPerDay). */
  vitaminsToday: { day: string; count: number };
  /** Misiones diarias. */
  missions: { day: string; list: MissionProgress[]; bonusClaimed: boolean };
  /** Identidad para el servidor (como en Mi Zoológico). */
  player: { id: string; apodo: string };
  online: {
    url: string;
    lastSync: number;
    /** Estadísticas anónimas de uso activadas (Ajustes › Servidor). */
    analytics: boolean;
    /** Eventos de uso pendientes de enviar (ver systems/online/Analytics.ts). */
    pendingEvents: { t: number; e: string; x?: string }[];
  };
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
    settings: { sound: true, haptics: true },
    decor: { ...DEFAULT_DECOR },
    decorOwned: Object.values(DEFAULT_DECOR),
    collection: {},
    collectionRewards: [],
    community: { pending: {}, week: '', mine: 0, claimed: [], last: null },
    surveyDone: false,
    entitlements: [],
    gameRecords: {},
    gamesToday: { day: '', coins: {} },
    vitaminsToday: { day: '', count: 0 },
    missions: { day: '', list: [], bonusClaimed: false },
    player: { id: '', apodo: '' },
    online: { url: '', lastSync: 0, analytics: true, pendingEvents: [] },
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
