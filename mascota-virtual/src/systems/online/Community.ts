/**
 * Community (Singleton): desafío semanal entre todos los jugadores (Auditoría P12).
 *
 * - Cada cuidado cuenta como "aporte" (baños, juegos, paseos...). Se envían en la sincronización
 *   normal y el servidor solo suma la acción del desafío de esa semana.
 * - Si entre todos se llega al objetivo, quien haya aportado algo esa semana recoge el premio una vez.
 * - Funciona con pocos jugadores: es asíncrono y no exige estar conectados a la vez.
 */
import { EventBus } from '../../core/EventBus';
import { GameState } from '../../core/GameState';
import { EconomySystem } from '../economy/EconomySystem';

export interface Challenge {
  semana: string;
  accion: string;
  titulo: string;
  objetivo: number;
  progreso: number;
  premio: { monedas: number; estrellas: number };
}

export class Community {
  private static _instance: Community | null = null;

  static get instance(): Community {
    if (!this._instance) this._instance = new Community();
    return this._instance;
  }

  private started = false;

  private get state() {
    return GameState.instance.data.community;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    EventBus.instance.on('interaction:performed', ({ actionId }) => {
      this.state.pending[actionId] = (this.state.pending[actionId] ?? 0) + 1;
      if (this.state.last && actionId === this.state.last.accion) this.state.mine++;
    });
  }

  /** Aportes pendientes de enviar (se borran al confirmarse). */
  pendingAportes(): Record<string, number> {
    return { ...this.state.pending };
  }

  /** El servidor confirmó la sincronización: guarda el estado del desafío. */
  onSynced(sent: Record<string, number>, desafio: Challenge | null | undefined): void {
    for (const [k, v] of Object.entries(sent)) {
      this.state.pending[k] = Math.max(0, (this.state.pending[k] ?? 0) - v);
      if (!this.state.pending[k]) delete this.state.pending[k];
    }
    if (!desafio) return;
    if (this.state.week !== desafio.semana) {
      // Semana nueva: lo que mandé en esta sincronización ya cuenta para ella
      this.state.week = desafio.semana;
      this.state.mine = sent[desafio.accion] ?? 0;
    }
    const antes = this.state.last;
    this.state.last = desafio;
    if (antes && antes.semana === desafio.semana && antes.progreso < antes.objetivo && desafio.progreso >= desafio.objetivo) {
      EventBus.instance.emit('ui:toast', { text: '🎉 ¡Desafío de la semana conseguido entre todos!', kind: 'good' });
    }
  }

  get current(): Challenge | null {
    return this.state.last;
  }

  get myContribution(): number {
    return this.state.week === this.state.last?.semana ? this.state.mine : 0;
  }

  canClaim(): boolean {
    const c = this.state.last;
    return !!c && c.progreso >= c.objetivo && this.myContribution > 0 && !this.state.claimed.includes(c.semana);
  }

  claim(): boolean {
    const c = this.state.last;
    if (!c || !this.canClaim()) return false;
    this.state.claimed.push(c.semana);
    this.state.claimed = this.state.claimed.slice(-20);
    EconomySystem.instance.addCoins(c.premio.monedas);
    if (c.premio.estrellas) EconomySystem.instance.addStars(c.premio.estrellas);
    return true;
  }
}
