/**
 * GameManager (Singleton): arranca el juego y mantiene el bucle de tiempo.
 *
 * - Carga la partida (aplicando el tiempo offline).
 * - Cada segundo avanza la simulación de las mascotas.
 * - Guarda automáticamente y al pasar la app a segundo plano.
 */
import { BreedingSystem } from '../systems/breeding/BreedingSystem';
import { PetManager } from '../systems/pet/PetManager';
import { SaveSystem, type OfflineReport } from '../systems/save/SaveSystem';
import { Clock } from './Clock';
import { GameConfig } from './GameConfig';

/** Si entre dos ticks pasa más que esto, se considera tiempo offline (app en segundo plano). */
const BACKGROUND_GAP_MS = 30_000;

export class GameManager {
  private static _instance: GameManager | null = null;

  static get instance(): GameManager {
    if (!this._instance) this._instance = new GameManager();
    return this._instance;
  }

  private lastTick = 0;
  private lastSave = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Inicializa: carga la partida y arranca el bucle. Devuelve el resumen offline. */
  async start(): Promise<OfflineReport | null> {
    const report = await SaveSystem.instance.load();
    this.lastTick = Clock.now();
    this.lastSave = this.lastTick;
    this.timer = setInterval(() => this.tick(), 1000);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') void this.save();
        else this.tick();
      });
      window.addEventListener('pagehide', () => void this.save());
    }
    return report;
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Avanza el tiempo desde el último tick. */
  tick(): void {
    const now = Clock.now();
    const elapsed = now - this.lastTick;
    this.lastTick = now;
    if (elapsed <= 0) return;
    PetManager.instance.update(Math.min(elapsed, GameConfig.MAX_OFFLINE_MS), elapsed > BACKGROUND_GAP_MS);
    BreedingSystem.instance.update(now);
    if (now - this.lastSave >= GameConfig.AUTOSAVE_MS) void this.save();
  }

  async save(): Promise<void> {
    this.lastSave = Clock.now();
    try {
      await SaveSystem.instance.save();
    } catch (err) {
      console.error('[GameManager] Error al guardar', err);
    }
  }
}
