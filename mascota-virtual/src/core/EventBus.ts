/**
 * EventBus: bus de eventos tipado para comunicar los sistemas entre sí.
 *
 * Es el equivalente a los `C# events` / `Action<T>` de Unity: un sistema
 * emite un evento y cualquier otro (UI, guardado, álbum...) se suscribe sin
 * que ambos se conozcan directamente.
 *
 * Para añadir un evento nuevo basta con declararlo en `GameEvents`.
 */
import type { GrowthStage, PetStatKey } from '../systems/pet/PetTypes';
import type { MemoryEntry } from '../systems/save/AlbumSystem';

/** Mapa de todos los eventos del juego y la información que transportan. */
export interface GameEvents {
  // --- Mascotas ---
  'pet:created': { petId: string; reason: 'start' | 'born' | 'adopted' };
  'pet:statsChanged': { petId: string };
  'pet:stageChanged': { petId: string; from: GrowthStage; to: GrowthStage };
  'pet:escaped': { petId: string };
  'pet:rescued': { petId: string };
  'pet:lostForever': { petId: string; name: string };
  'pet:removed': { petId: string };
  'pet:locationChanged': { petId: string };
  'pet:sleepChanged': { petId: string; sleeping: boolean };
  'pet:activeChanged': { petId: string | null };

  // --- Interacciones ---
  'interaction:performed': {
    petId: string;
    actionId: string;
    animation: string;
    deltas: Partial<Record<PetStatKey, number>>;
    message?: string;
    coinsFound?: number;
  };
  'trick:learned': { petId: string; trickId: string };

  // --- Economía ---
  'economy:walletChanged': { coins: number; stars: number };
  'economy:inventoryChanged': { itemId: string; quantity: number };
  'economy:purchase': { itemId: string };

  // --- Competencias ---
  'competition:finished': {
    petId: string;
    competitionId: string;
    score: number;
    rating: number;
    coins: number;
    stars: number;
  };

  // --- Minijuegos ---
  'game:finished': { petId: string; gameId: string; score: number };

  // --- Crianza ---
  'breeding:born': { babyId: string; parentA: string; parentB: string };
  'adoption:completed': { petName: string; coins: number };

  // --- Guardado / álbum ---
  'album:added': { entry: MemoryEntry };
  'save:loaded': { offlineMs: number };
  'save:saved': { at: number };

  // --- Servidor ---
  'online:status': { status: string };
  'online:synced': { coins: number; adopted: number };
  'online:gift': { title: string; message: string; coins: number; stars: number; item: string | null };

  // --- UI genérica ---
  'ui:toast': { text: string; kind?: 'info' | 'good' | 'bad' };
}

type Handler<T> = (payload: T) => void;

export class EventBus {
  private static _instance: EventBus | null = null;

  /** Acceso Singleton. */
  static get instance(): EventBus {
    if (!this._instance) this._instance = new EventBus();
    return this._instance;
  }

  private handlers = new Map<keyof GameEvents, Set<Handler<any>>>();

  /** Se suscribe a un evento. Devuelve una función para desuscribirse. */
  on<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => this.off(event, handler);
  }

  off<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>): void {
    this.handlers.get(event)?.delete(handler);
  }

  /** Emite un evento a todos los suscriptores. Un fallo en uno no rompe a los demás. */
  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] Error en handler de "${event}"`, err);
      }
    }
  }

  /** Elimina todas las suscripciones (útil en tests). */
  clear(): void {
    this.handlers.clear();
  }
}

/** Atajo: muestra un aviso en pantalla. */
export function toast(text: string, kind: 'info' | 'good' | 'bad' = 'info'): void {
  EventBus.instance.emit('ui:toast', { text, kind });
}
