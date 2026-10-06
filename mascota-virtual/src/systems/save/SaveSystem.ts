/**
 * SaveSystem (Singleton): guardar/cargar la partida completa en JSON.
 *
 * Al cargar calcula cuánto tiempo estuvo el jugador fuera y simula ese
 * tiempo (degradación de stats, crecimiento, escapes, adopciones) para que
 * la mascota "viva" aunque la app esté cerrada.
 */
import { Clock } from '../../core/Clock';
import { EventBus } from '../../core/EventBus';
import { GameConfig } from '../../core/GameConfig';
import { GameState, SAVE_VERSION, createEmptyGameData, type GameData } from '../../core/GameState';
import { Pet } from '../pet/Pet';
import { PetManager } from '../pet/PetManager';
import type { GrowthStage, PetData } from '../pet/PetTypes';
import { createDefaultStorage, type KeyValueStorage } from './Storage';

const SAVE_KEY = 'mascota_virtual_save';

/** Resumen de lo que pasó mientras el jugador no estaba. */
export interface OfflineReport {
  offlineMs: number;
  stageUps: { name: string; stage: GrowthStage }[];
  escaped: string[];
  lostForever: string[];
  adopted: { name: string; coins: number }[];
  /** Cambio de stats importantes por mascota. */
  changes: { name: string; hunger: number; happiness: number; health: number }[];
}

export class SaveSystem {
  private static _instance: SaveSystem | null = null;

  static get instance(): SaveSystem {
    if (!this._instance) this._instance = new SaveSystem();
    return this._instance;
  }

  storage: KeyValueStorage = createDefaultStorage();

  /** Convierte la partida a JSON. */
  serialize(now = Clock.now()): string {
    const data = GameState.instance.data;
    data.lastSavedAt = now;
    return JSON.stringify(data);
  }

  async save(): Promise<void> {
    const now = Clock.now();
    await this.storage.set(SAVE_KEY, this.serialize(now));
    EventBus.instance.emit('save:saved', { at: now });
  }

  async hasSave(): Promise<boolean> {
    return (await this.storage.get(SAVE_KEY)) !== null;
  }

  async deleteSave(): Promise<void> {
    await this.storage.remove(SAVE_KEY);
    GameState.instance.reset(Clock.now());
    PetManager.instance.rebuild();
  }

  /**
   * Carga la partida guardada (si existe) y aplica el tiempo offline.
   * @returns el resumen offline, o null si no había partida
   */
  async load(): Promise<OfflineReport | null> {
    const raw = await this.storage.get(SAVE_KEY);
    if (!raw) {
      GameState.instance.reset(Clock.now());
      PetManager.instance.rebuild();
      return null;
    }
    return this.loadFromJson(raw);
  }

  /** Carga desde un JSON (también sirve para importar copias de seguridad). */
  loadFromJson(json: string): OfflineReport {
    const parsed = JSON.parse(json) as Partial<GameData>;
    const data = this.migrate(parsed);
    GameState.instance.load(data);
    PetManager.instance.rebuild();

    const offlineMs = Math.min(Math.max(0, Clock.now() - data.lastSavedAt), GameConfig.MAX_OFFLINE_MS);
    const report = this.applyOffline(offlineMs);
    data.lastSavedAt = Clock.now();
    EventBus.instance.emit('save:loaded', { offlineMs });
    return report;
  }

  /** Simula el tiempo offline y recoge lo ocurrido para mostrárselo al jugador. */
  applyOffline(offlineMs: number): OfflineReport {
    const report: OfflineReport = { offlineMs, stageUps: [], escaped: [], lostForever: [], adopted: [], changes: [] };
    if (offlineMs < 1000) return report;

    const before = new Map(
      PetManager.instance.homePets().map((p) => [p.id, { ...p.stats }]),
    );
    const bus = EventBus.instance;
    const offs = [
      bus.on('pet:stageChanged', ({ petId, to }) => {
        const p = PetManager.instance.get(petId);
        if (p) report.stageUps.push({ name: p.name, stage: to });
      }),
      bus.on('pet:escaped', ({ petId }) => {
        const p = PetManager.instance.get(petId);
        if (p) report.escaped.push(p.name);
      }),
      bus.on('pet:lostForever', ({ name }) => report.lostForever.push(name)),
      bus.on('adoption:completed', ({ petName, coins }) => report.adopted.push({ name: petName, coins })),
    ];
    try {
      PetManager.instance.update(offlineMs, true);
    } finally {
      offs.forEach((off) => off());
    }

    for (const [id, stats] of before) {
      const pet = PetManager.instance.get(id);
      if (!pet) continue;
      report.changes.push({
        name: pet.name,
        hunger: Math.round(pet.stats.hunger - stats.hunger),
        happiness: Math.round(pet.stats.happiness - stats.happiness),
        health: Math.round(pet.stats.health - stats.health),
      });
    }
    return report;
  }

  /**
   * Adapta partidas antiguas a la versión actual rellenando campos que falten.
   * Al añadir campos nuevos en el futuro, sube SAVE_VERSION y añade aquí la conversión.
   */
  migrate(raw: Partial<GameData>): GameData {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.pets)) {
      throw new Error('Partida guardada no válida');
    }
    const defaults = createEmptyGameData(raw.createdAt ?? Clock.now());
    const data: GameData = {
      ...defaults,
      ...raw,
      wallet: { ...defaults.wallet, ...raw.wallet },
      daily: { ...defaults.daily, ...raw.daily },
      counters: { ...defaults.counters, ...raw.counters },
      version: SAVE_VERSION,
    } as GameData;

    // Rellenar campos nuevos de mascotas usando una mascota "plantilla"
    data.pets = raw.pets!.map((p) => {
      const template = Pet.create({ name: p.name ?? 'Mascota', speciesId: p.speciesId, now: p.bornAt ?? Clock.now() }).data;
      return {
        ...template,
        ...p,
        stats: { ...template.stats, ...p.stats },
        genes: { ...template.genes, ...p.genes },
        care: { ...template.care, ...p.care },
      } as PetData;
    });
    return data;
  }

  // ---------- Copias de seguridad ----------

  exportJson(): string {
    return this.serialize();
  }

  importJson(json: string): OfflineReport {
    return this.loadFromJson(json);
  }
}
