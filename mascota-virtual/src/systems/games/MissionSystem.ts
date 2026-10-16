/**
 * MissionSystem (Singleton): 3 misiones diarias según la etapa de la mascota.
 * Escucha los eventos del juego (acciones, minijuegos, compras...) para
 * avanzar el progreso. Completar las 3 da un premio extra.
 */
import { Clock } from '../../core/Clock';
import { EventBus } from '../../core/EventBus';
import { GameState } from '../../core/GameState';
import { seededRng } from '../../core/random';
import { MISSIONS, MISSION_BONUS, type MissionDefinition } from '../../data/missions';
import { EconomySystem } from '../economy/EconomySystem';
import { PetManager } from '../pet/PetManager';
import { GrowthStage, STAGE_ORDER } from '../pet/PetTypes';
import { dayKey } from './GamesSystem';

export interface MissionProgress {
  id: string;
  progress: number;
  claimed: boolean;
}

export class MissionSystem {
  private static _instance: MissionSystem | null = null;

  static get instance(): MissionSystem {
    if (!this._instance) this._instance = new MissionSystem();
    return this._instance;
  }

  private listening = false;

  /** Empieza a escuchar eventos (se llama una vez al arrancar). */
  start(): void {
    if (this.listening) return;
    this.listening = true;
    const bus = EventBus.instance;
    bus.on('interaction:performed', ({ actionId }) => this.track(`action:${actionId}`));
    bus.on('game:finished', ({ gameId, score }) => this.track('game', { gameId, score }));
    bus.on('competition:finished', () => this.track('competition'));
    bus.on('economy:purchase', () => this.track('purchase'));
  }

  /** Misiones de hoy (las genera si cambió el día). */
  today(): { def: MissionDefinition; state: MissionProgress }[] {
    this.ensureToday();
    const m = GameState.instance.data.missions;
    return m.list.map((state) => ({ def: MISSIONS.find((d) => d.id === state.id)!, state })).filter((x) => x.def);
  }

  /** Cuántas misiones se pueden cobrar ahora (para el globo de aviso). */
  claimableCount(): number {
    const list = this.today();
    const n = list.filter((x) => !x.state.claimed && x.state.progress >= x.def.goal).length;
    return n + (this.bonusAvailable() ? 1 : 0);
  }

  bonusAvailable(): boolean {
    const m = GameState.instance.data.missions;
    return !m.bonusClaimed && m.list.length > 0 && m.list.every((x) => x.claimed);
  }

  claim(id: string): number {
    const item = this.today().find((x) => x.def.id === id);
    if (!item || item.state.claimed || item.state.progress < item.def.goal) return 0;
    item.state.claimed = true;
    EconomySystem.instance.addCoins(item.def.reward);
    return item.def.reward;
  }

  claimBonus(): boolean {
    if (!this.bonusAvailable()) return false;
    GameState.instance.data.missions.bonusClaimed = true;
    EconomySystem.instance.addCoins(MISSION_BONUS.coins);
    EconomySystem.instance.addStars(MISSION_BONUS.stars);
    return true;
  }

  private ensureToday(): void {
    const state = GameState.instance.data;
    const today = dayKey(Clock.now());
    if (state.missions.day === today && state.missions.list.length) return;
    const stage = PetManager.instance.selected?.stage ?? GrowthStage.Baby;
    const eligible = MISSIONS.filter((m) => STAGE_ORDER.indexOf(stage) >= STAGE_ORDER.indexOf(m.minStage));
    // Mezcla estable para el día
    const r = seededRng([...today].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    const picked = [...eligible].sort(() => r() - 0.5).slice(0, 3);
    state.missions = { day: today, list: picked.map((m) => ({ id: m.id, progress: 0, claimed: false })), bonusClaimed: false };
  }

  private track(event: string, game?: { gameId: string; score: number }): void {
    for (const { def, state } of this.today()) {
      if (state.claimed || state.progress >= def.goal) continue;
      const [kind, id, min] = def.event.split(':');
      let hit = false;
      if (kind === 'action') hit = event === def.event;
      else if (kind === 'game' && event === 'game') hit = !id || (game?.gameId === id && game.score >= Number(min || 1));
      else hit = event === kind;
      if (hit) state.progress++;
    }
  }
}
