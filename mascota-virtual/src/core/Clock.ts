/**
 * Reloj del juego. Toda la lógica pide la hora aquí (y no a Date.now())
 * para poder simular el paso del tiempo en tests y en el cálculo offline.
 */
import { GameConfig } from './GameConfig';

export class Clock {
  private static offsetMs = 0;
  private static fixedNow: number | null = null;

  static now(): number {
    return (this.fixedNow ?? Date.now()) + this.offsetMs;
  }

  /** Solo para tests / depuración: fija la hora actual. */
  static setNow(ms: number | null): void {
    this.fixedNow = ms;
  }

  /** Solo para depuración: adelanta el reloj. */
  static advance(ms: number): void {
    this.offsetMs += ms;
  }

  static realMsToGameDays(ms: number): number {
    return ms / GameConfig.REAL_MS_PER_GAME_DAY;
  }

  static gameDaysToRealMs(days: number): number {
    return days * GameConfig.REAL_MS_PER_GAME_DAY;
  }
}

/** Formatea una duración en ms reales como texto corto ("1h 20m", "45s"). */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
