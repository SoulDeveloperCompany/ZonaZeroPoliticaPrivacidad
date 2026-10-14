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
/** Copia de respaldo: se escribe en cada guardado; si la principal se daña, se carga esta. */
const BACKUP_KEY = 'mascota_virtual_save_bak';
/** Si las dos están dañadas, se guarda aquí lo que había (por si se puede recuperar a mano). */
const BROKEN_KEY = 'mascota_virtual_save_danada';

/** Resumen de lo que pasó mientras el jugador no estaba. */
export interface OfflineReport {
  offlineMs: number;
  stageUps: { name: string; stage: GrowthStage }[];
  escaped: string[];
  returned: string[];
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
  /** Si la última carga tuvo que recuperar la partida: 'backup' (copia de respaldo) o 'none' (nada recuperable). */
  recoveredFrom: 'backup' | 'none' | null = null;

  /** Convierte la partida a JSON. */
  serialize(now = Clock.now()): string {
    const data = GameState.instance.data;
    data.lastSavedAt = now;
    return JSON.stringify(data);
  }

  async save(): Promise<void> {
    const now = Clock.now();
    const json = this.serialize(now);
    // Primero el respaldo y luego la principal: si se corta a mitad, una de las dos queda entera
    await this.storage.set(BACKUP_KEY, json);
    await this.storage.set(SAVE_KEY, json);
    EventBus.instance.emit('save:saved', { at: now });
  }

  async hasSave(): Promise<boolean> {
    return (await this.storage.get(SAVE_KEY)) !== null;
  }

  async deleteSave(): Promise<void> {
    await this.storage.remove(SAVE_KEY);
    await this.storage.remove(BACKUP_KEY);
    GameState.instance.reset(Clock.now());
    PetManager.instance.rebuild();
  }

  /**
   * Carga la partida guardada (si existe) y aplica el tiempo offline.
   * @returns el resumen offline, o null si no había partida
   */
  async load(): Promise<OfflineReport | null> {
    this.recoveredFrom = null;
    const raw = await this.storage.get(SAVE_KEY);
    const backup = await this.storage.get(BACKUP_KEY);
    if (!raw && !backup) {
      GameState.instance.reset(Clock.now());
      PetManager.instance.rebuild();
      return null;
    }
    for (const [json, origen] of [[raw, 'principal'], [backup, 'respaldo']] as const) {
      if (!json) continue;
      try {
        const report = this.loadFromJson(json);
        this.recoveredFrom = origen === 'respaldo' ? 'backup' : null;
        if (this.recoveredFrom) EventBus.instance.emit('save:recovered', { from: 'backup' });
        return report;
      } catch (err) {
        console.warn(`Partida ${origen} dañada`, err);
      }
    }
    // Las dos dañadas: se conserva lo que había y se empieza de nuevo (nunca dejar el juego bloqueado)
    await this.storage.set(BROKEN_KEY, raw ?? backup ?? '');
    GameState.instance.reset(Clock.now());
    PetManager.instance.rebuild();
    this.recoveredFrom = 'none';
    EventBus.instance.emit('save:recovered', { from: 'none' });
    return null;
  }

  /** Carga desde un JSON (también sirve para importar copias de seguridad). */
  loadFromJson(json: string): OfflineReport {
    const parsed = JSON.parse(json) as Partial<GameData>;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.pets)) throw new Error('Partida con formato no válido');
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
    const report: OfflineReport = { offlineMs, stageUps: [], escaped: [], returned: [], adopted: [], changes: [] };
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
      bus.on('pet:returnedHome', ({ name }) => report.returned.push(name)),
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
      online: { ...defaults.online, ...raw.online },
      settings: { ...defaults.settings, ...raw.settings },
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
    if ((raw.version ?? 1) < 2) {
      data.pets.forEach(migrateAgeV1toV2);
      if (data.pets.length > 0) data.tutorialDone = true;
    }
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

/** Inicio de cada etapa antes (v1, días de 1 hora) y ahora (v2, días reales). */
const STARTS_V1 = [0, 3, 7, 14, 45];
const STARTS_V2 = [0, 1, 3, 7, 60];

/**
 * v1 → v2: la edad pasa de "días de juego de 1 hora" a días reales.
 * Nadie retrocede de etapa: se conserva la etapa y el avance proporcional dentro de ella.
 */
export function migrateAgeV1toV2(p: PetData): void {
  const old = p.ageDays ?? 0;
  let i = 0;
  while (i + 1 < STARTS_V1.length && old >= STARTS_V1[i + 1]) i++;
  const frac = i + 1 < STARTS_V1.length ? (old - STARTS_V1[i]) / (STARTS_V1[i + 1] - STARTS_V1[i]) : 0;
  const span = i + 1 < STARTS_V2.length ? STARTS_V2[i + 1] - STARTS_V2[i] : 0;
  p.ageDays = i + 1 < STARTS_V1.length ? STARTS_V2[i] + frac * span : STARTS_V2[i] + (old - STARTS_V1[i]) / 24;
  p.lastBredAtDay = null;
}
