/**
 * BondSystem (Singleton): vínculo con el dueño, primeras veces y comida favorita (Auditoría P8-P9).
 *
 * - El vínculo (0-100) sube con cuidados VARIADOS (repetir la misma acción vale menos) y NUNCA baja:
 *   no hay castigo por no entrar. Tope diario para que crezca a lo largo de ~10 días de juego normal.
 * - Hitos 20/40/60/80/100: recuerdo en el álbum, celebración y gestos nuevos en casa.
 * - Primeras veces (primer baño, primer paseo...) se guardan solas en el álbum.
 * - La comida que más le das se convierte en su favorita (le alegra más).
 */
import { Clock } from '../../core/Clock';
import { EventBus } from '../../core/EventBus';
import { getTrait } from '../../data/traits';
import { AlbumSystem } from '../save/AlbumSystem';
import type { Pet } from './Pet';
import { PetManager } from './PetManager';

/** Cuánto vínculo da cada acción antes de modificadores. */
const BOND_BY_ACTION: Record<string, number> = { feed: 0.8, pet: 1.2, bathe: 1, play: 1.5, train: 1.2, walk: 1.5 };
/** Vínculo máximo que se puede ganar al día (100 en ~10 días de cuidados). */
export const BOND_PER_DAY = 10;
export const BOND_LEVELS = [20, 40, 60, 80, 100] as const;
/** Veces que hay que dar una comida para que se convierta en favorita. */
const FAVORITE_AFTER = 5;

const BOND_TEXT: Record<number, string> = {
  20: 'Ya te reconoce: te mira cuando entras.',
  40: 'Confía en ti: viene corriendo a saludarte.',
  60: 'Te adora: a veces hace un truco solo para ti.',
  80: 'Sois inseparables: te trae su juguete favorito.',
  100: 'Vínculo máximo: un amor para siempre. 💞',
};

const FIRSTS: Record<string, string> = {
  bathe: 'Su primer baño',
  play: 'Su primera partida de juego',
  train: 'Su primer entrenamiento',
  walk: 'Su primer paseo',
};

export class BondSystem {
  private static _instance: BondSystem | null = null;

  static get instance(): BondSystem {
    if (!this._instance) this._instance = new BondSystem();
    return this._instance;
  }

  private started = false;

  /** Escucha los cuidados. Se llama una vez al arrancar el juego. */
  start(): void {
    if (this.started) return;
    this.started = true;
    EventBus.instance.on('interaction:performed', ({ petId, actionId, itemId }) => {
      const pet = PetManager.instance.get(petId);
      if (pet) this.onCare(pet, actionId, itemId);
    });
    EventBus.instance.on('game:finished', ({ petId }) => {
      const pet = PetManager.instance.get(petId);
      if (pet) this.gain(pet, 1);
    });
  }

  static levelOf(bond: number): number {
    return BOND_LEVELS.filter((l) => bond >= l).pop() ?? 0;
  }

  static textFor(level: number): string {
    return BOND_TEXT[level] ?? 'Os estáis conociendo.';
  }

  /** Un cuidado: vínculo, primeras veces y comida favorita. */
  onCare(pet: Pet, actionId: string, itemId?: string): void {
    const d = pet.data;
    const recent = d.recentActions ?? [];
    const repetida = recent.slice(-3).filter((a) => a === actionId).length;
    d.recentActions = [...recent, actionId].slice(-6);
    const variedad = repetida === 0 ? 1 : repetida === 1 ? 0.6 : 0.3;
    this.gain(pet, (BOND_BY_ACTION[actionId] ?? 0.5) * variedad);

    if (FIRSTS[actionId] && !d.firsts.includes(actionId)) {
      d.firsts.push(actionId);
      AlbumSystem.instance.add(pet, 'first', FIRSTS[actionId], `${pet.name} vivió ${FIRSTS[actionId].toLowerCase()} contigo.`);
    }
    if (actionId === 'feed' && itemId && itemId !== 'food_basic') {
      d.foodCounts[itemId] = (d.foodCounts[itemId] ?? 0) + 1;
      const top = Object.entries(d.foodCounts).sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] >= FAVORITE_AFTER && d.favoriteFood !== top[0]) {
        d.favoriteFood = top[0];
        AlbumSystem.instance.add(pet, 'first', '¡Ya tiene comida favorita!', `De tanto dársela, a ${pet.name} le encanta.`);
      }
    }
  }

  /** Suma vínculo respetando el tope diario y el carácter; avisa al cruzar un hito. */
  gain(pet: Pet, amount: number): void {
    const d = pet.data;
    const hoy = new Date(Clock.now()).toDateString();
    if (d.bondToday.day !== hoy) d.bondToday = { day: hoy, gained: 0 };
    const mul = d.traits.reduce((m, t) => m * (getTrait(t)?.bondMul ?? 1), 1);
    const real = Math.max(0, Math.min(amount * mul, BOND_PER_DAY - d.bondToday.gained, 100 - d.bond));
    if (real <= 0) return;
    const antes = BondSystem.levelOf(d.bond);
    d.bond += real;
    d.bondToday.gained += real;
    const ahora = BondSystem.levelOf(d.bond);
    if (ahora > antes) {
      AlbumSystem.instance.add(pet, 'bond', `Vínculo ${ahora}`, `${pet.name}: ${BondSystem.textFor(ahora)}`);
      EventBus.instance.emit('pet:bondMilestone', { petId: pet.id, level: ahora });
    }
  }
}
