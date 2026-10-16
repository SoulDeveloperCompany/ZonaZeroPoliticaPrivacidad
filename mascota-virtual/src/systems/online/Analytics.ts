/**
 * Analytics (Singleton): estadísticas ANÓNIMAS de uso para saber si el juego mejora
 * (retención D1/D7, en qué etapa se abandona, qué minijuegos se usan...).
 *
 * - Solo guarda tipo de evento + un dato corto (p. ej. 'etapa' + 'adult'), con el ID aleatorio del jugador.
 * - No envía nada por su cuenta: los eventos viajan dentro de la sincronización normal con el servidor.
 * - El jugador puede desactivarlo en Ajustes › Servidor ("Enviar estadísticas anónimas").
 * - Resumen: `npm run -s metricas` (pide ?accion=metricas al Apps Script).
 */
import { Clock } from '../../core/Clock';
import { EventBus } from '../../core/EventBus';
import { GameState } from '../../core/GameState';
import { PetManager } from '../pet/PetManager';

export interface UsageEvent {
  /** Momento (ms). */
  t: number;
  /** Tipo de evento. */
  e: string;
  /** Dato corto opcional. */
  x?: string;
}

/** Eventos guardados como máximo mientras no hay conexión (se descartan los más antiguos). */
const MAX_PENDING = 200;
/** Volver a la app tras este tiempo cuenta como sesión nueva. */
const NEW_SESSION_MS = 30 * 60 * 1000;

export class Analytics {
  private static _instance: Analytics | null = null;

  static get instance(): Analytics {
    if (!this._instance) this._instance = new Analytics();
    return this._instance;
  }

  private started = false;
  private lastSeen = 0;

  private get online() {
    return GameState.instance.data.online;
  }

  get enabled(): boolean {
    return this.online.analytics !== false;
  }

  setEnabled(on: boolean): void {
    this.online.analytics = on;
    if (!on) this.online.pendingEvents = [];
  }

  /** Apunta un evento (si el jugador no lo ha desactivado). */
  track(e: string, x?: string): void {
    if (!this.enabled) return;
    const list = (this.online.pendingEvents ??= []);
    list.push(x ? { t: Clock.now(), e, x: String(x).slice(0, 40) } : { t: Clock.now(), e });
    if (list.length > MAX_PENDING) list.splice(0, list.length - MAX_PENDING);
  }

  /** Eventos para enviar en la próxima sincronización. */
  pending(max = 40): UsageEvent[] {
    return this.enabled ? (this.online.pendingEvents ?? []).slice(0, max) : [];
  }

  /** El servidor confirmó los `n` primeros: se borran. */
  acknowledge(n: number): void {
    this.online.pendingEvents?.splice(0, n);
  }

  /** Llama al volver a la app (cuenta una sesión nueva si estuvo fuera un rato). */
  resume(): void {
    const now = Clock.now();
    if (now - this.lastSeen >= NEW_SESSION_MS) this.track('sesion');
    this.lastSeen = now;
  }

  pause(): void {
    this.lastSeen = Clock.now();
  }

  /** Empieza a escuchar los eventos del juego. Se llama una vez al arrancar. */
  start(): void {
    if (this.started) return;
    this.started = true;
    const bus = EventBus.instance;
    this.resume();
    bus.on('pet:created', ({ petId, reason }) => this.track(reason === 'start' ? 'adopcion_inicial' : reason === 'born' ? 'cria' : 'adopcion', PetManager.instance.get(petId)?.data.speciesId));
    bus.on('pet:stageChanged', ({ to }) => this.track('etapa', to));
    bus.on('game:finished', ({ gameId }) => this.track('minijuego', gameId));
    bus.on('competition:finished', ({ competitionId }) => this.track('competencia', competitionId));
    bus.on('economy:purchase', ({ itemId }) => this.track('compra', itemId));
    bus.on('pet:escaped', () => this.track('escape'));
  }
}
