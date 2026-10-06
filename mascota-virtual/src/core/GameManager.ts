/**
 * GameManager (Singleton): arranca el juego y mantiene el bucle de tiempo.
 *
 * - Carga la partida (aplicando el tiempo offline).
 * - Cada segundo avanza la simulación de las mascotas.
 * - Guarda automáticamente y al pasar la app a segundo plano.
 */
import { BreedingSystem } from '../systems/breeding/BreedingSystem';
import { EconomySystem } from '../systems/economy/EconomySystem';
import { OnlineService } from '../systems/online/OnlineService';
import { EventBus, toast } from './EventBus';
import { OnlineConfig } from './OnlineConfig';
import { MissionSystem } from '../systems/games/MissionSystem';
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
  private lastSync = 0;
  private syncing = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Inicializa: carga la partida y arranca el bucle. Devuelve el resumen offline. */
  async start(): Promise<OfflineReport | null> {
    const report = await SaveSystem.instance.load();
    MissionSystem.instance.start();
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
    if (now - this.lastSave >= GameConfig.AUTOSAVE_MS) void this.save();
    if (now - this.lastSync >= OnlineConfig.SYNC_EVERY_MS) void this.syncOnline();
  }

  /**
   * Sincroniza con el servidor: sube la mascota principal (para el parque de
   * los demás) y recibe monedas y adopciones de otros jugadores.
   */
  async syncOnline(): Promise<boolean> {
    const online = OnlineService.instance;
    this.lastSync = Clock.now();
    if (this.syncing || !online.isConfigured()) return false;
    this.syncing = true;
    try {
      const r = await online.sync(PetManager.instance.selected);
      const adopted = BreedingSystem.instance.applyAdopted(r.adoptadas);
      if (r.monedas > 0) {
        EconomySystem.instance.addCoins(r.monedas);
        toast(`🌐 Otros jugadores te pagaron ${r.monedas} 🪙`, 'good');
      }
      for (const g of r.regalos) {
        const item = EconomySystem.instance.giveGift(g);
        EventBus.instance.emit('online:gift', { title: g.regalo, message: g.mensaje, coins: g.monedas, stars: g.estrellas, item });
      }
      EventBus.instance.emit('online:synced', { coins: r.monedas, adopted });
      return true;
    } catch {
      EventBus.instance.emit('online:status', { status: online.status });
      return false;
    } finally {
      this.syncing = false;
    }
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
