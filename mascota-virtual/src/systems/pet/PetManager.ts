/**
 * PetManager (Singleton): administra todas las mascotas del jugador.
 *
 * - Crea mascotas y respeta el límite de 3 activas (el resto va al rancho).
 * - Hace avanzar el tiempo: degradación de stats, crecimiento, escapes.
 * - Gestiona el escape (salud 0) y el rescate en un plazo de 48 h.
 */
import { Clock } from '../../core/Clock';
import { EventBus, toast } from '../../core/EventBus';
import { GameConfig } from '../../core/GameConfig';
import { GameState } from '../../core/GameState';
import { chance } from '../../core/random';
import { getFurnitureBonus } from '../economy/furniture';
import { GrowthSystem } from '../growth/GrowthSystem';
import { AlbumSystem } from '../save/AlbumSystem';
import { Pet } from './Pet';
import { PetLocation, type PetData } from './PetTypes';

export type SearchResult =
  | { ok: true }
  | { ok: false; reason: 'cooldown'; remainingMs: number }
  | { ok: false; reason: 'notFound'; chance: number }
  | { ok: false; reason: 'invalid' };

export class PetManager {
  private static _instance: PetManager | null = null;

  static get instance(): PetManager {
    if (!this._instance) this._instance = new PetManager();
    return this._instance;
  }

  /** Caché de objetos Pet sobre los PetData de GameState. */
  private cache = new Map<string, Pet>();

  private get state() {
    return GameState.instance.data;
  }

  /** Reconstruye la caché tras cargar una partida. */
  rebuild(): void {
    this.cache.clear();
    for (const data of this.state.pets) this.cache.set(data.id, new Pet(data));
    const active = this.state.activePetId;
    if (!active || !this.cache.has(active)) {
      this.state.activePetId = this.homePets()[0]?.id ?? null;
    }
  }

  // ---------- Consultas ----------

  all(): Pet[] {
    return this.state.pets.map((d) => this.wrap(d));
  }

  get(id: string): Pet | undefined {
    const data = this.state.pets.find((p) => p.id === id);
    return data ? this.wrap(data) : undefined;
  }

  /** Mascotas "en casa": activas y escapadas (ocupan hueco de las 3). */
  homePets(): Pet[] {
    return this.all().filter(
      (p) => p.data.location === PetLocation.Active || p.data.location === PetLocation.Escaped,
    );
  }

  byLocation(location: PetLocation): Pet[] {
    return this.all().filter((p) => p.data.location === location);
  }

  /** Mascota seleccionada en la pantalla principal. */
  get selected(): Pet | undefined {
    return this.state.activePetId ? this.get(this.state.activePetId) : undefined;
  }

  select(id: string | null): void {
    this.state.activePetId = id;
    EventBus.instance.emit('pet:activeChanged', { petId: id });
  }

  hasFreeSlot(): boolean {
    return this.homePets().length < GameConfig.MAX_ACTIVE_PETS;
  }

  // ---------- Altas y bajas ----------

  /**
   * Añade una mascota a la partida. Si ya hay 3 en casa, va al rancho.
   * @returns la ubicación final de la mascota
   */
  add(pet: Pet, reason: 'start' | 'born' | 'adopted'): PetLocation {
    pet.data.location = this.hasFreeSlot() ? PetLocation.Active : PetLocation.Ranch;
    this.state.pets.push(pet.data);
    this.cache.set(pet.id, pet);
    if (!this.selected && pet.isActive) this.select(pet.id);
    EventBus.instance.emit('pet:created', { petId: pet.id, reason });
    return pet.data.location;
  }

  /** Crea la primera mascota de la partida. */
  createStarter(speciesId: string, name: string): Pet {
    const pet = Pet.create({ name, speciesId, now: Clock.now() });
    this.add(pet, 'start');
    this.select(pet.id);
    AlbumSystem.instance.add(pet, 'birth', '¡Llegó a casa!', `${pet.name} ha llegado a tu vida.`);
    return pet;
  }

  /** Cambia el nombre de una mascota. */
  rename(id: string, name: string): boolean {
    const pet = this.get(id);
    const clean = name.trim().slice(0, 16);
    if (!pet || !clean) return false;
    pet.data.name = clean;
    EventBus.instance.emit('pet:statsChanged', { petId: id });
    return true;
  }

  remove(id: string): void {
    this.state.pets = this.state.pets.filter((p) => p.id !== id);
    this.cache.delete(id);
    if (this.state.activePetId === id) this.select(this.homePets()[0]?.id ?? null);
    EventBus.instance.emit('pet:removed', { petId: id });
  }

  // ---------- Rancho ----------

  moveToRanch(id: string): boolean {
    const pet = this.get(id);
    if (!pet || !pet.isActive) return false;
    pet.data.location = PetLocation.Ranch;
    pet.data.sleeping = false;
    if (this.state.activePetId === id) this.select(this.homePets()[0]?.id ?? null);
    EventBus.instance.emit('pet:locationChanged', { petId: id });
    return true;
  }

  moveToHome(id: string): boolean {
    const pet = this.get(id);
    if (!pet || pet.data.location !== PetLocation.Ranch || !this.hasFreeSlot()) return false;
    pet.data.location = PetLocation.Active;
    EventBus.instance.emit('pet:locationChanged', { petId: id });
    if (!this.selected) this.select(id);
    return true;
  }

  // ---------- Paso del tiempo ----------

  /**
   * Avanza la simulación `realMs` milisegundos reales.
   * Se divide en pasos pequeños para que el cálculo offline sea fiel
   * (p. ej. que el escape ocurra en el momento correcto).
   */
  update(realMs: number, offline = false): void {
    if (realMs <= 0) return;
    const totalDays = Clock.realMsToGameDays(realMs);
    const steps = Math.max(1, Math.ceil(totalDays / GameConfig.SIMULATION_STEP_DAYS));
    const stepDays = totalDays / steps;
    const stepMs = realMs / steps;
    const furniture = getFurnitureBonus();
    let simNow = Clock.now() - realMs;

    for (let i = 0; i < steps; i++) {
      simNow += stepMs;
      for (const pet of this.all()) {
        if (pet.isActive) {
          const wasSleeping = pet.data.sleeping;
          pet.simulateDecay(stepDays, { furniture, offline, now: simNow });
          GrowthSystem.instance.advance(pet, stepDays, simNow);
          if (wasSleeping !== pet.data.sleeping && !offline) {
            EventBus.instance.emit('pet:sleepChanged', { petId: pet.id, sleeping: pet.data.sleeping });
          }
          if (pet.stats.health <= 0) this.escape(pet, simNow);
        } else if (pet.isEscaped) {
          this.checkEscapeExpired(pet, simNow);
        }
      }
    }
    for (const pet of this.all()) {
      if (pet.isActive) EventBus.instance.emit('pet:statsChanged', { petId: pet.id });
    }
  }

  // ---------- Escape y rescate ----------

  /** La salud llegó a 0: la mascota se escapa (nunca muere). */
  private escape(pet: Pet, at: number): void {
    pet.data.location = PetLocation.Escaped;
    pet.data.escapedAt = at;
    pet.data.sleeping = false;
    pet.data.rescueAttempts = 0;
    pet.data.lastSearchAt = null;
    AlbumSystem.instance.add(
      pet,
      'escape',
      '¡Se ha escapado!',
      `A ${pet.name} le faltaron cuidados y se fue de casa. Tienes 48 horas para seguir su rastro.`,
    );
    EventBus.instance.emit('pet:escaped', { petId: pet.id });
    toast(`¡${pet.name} se ha escapado! Tienes 48 h para encontrar su rastro.`, 'bad');
  }

  /** Tiempo restante (ms) para recuperar a una mascota escapada. */
  escapeTimeLeft(pet: Pet, now = Clock.now()): number {
    if (!pet.isEscaped || pet.data.escapedAt === null) return 0;
    return Math.max(0, pet.data.escapedAt + GameConfig.ESCAPE.recoveryWindowMs - now);
  }

  private checkEscapeExpired(pet: Pet, now: number): void {
    if (this.escapeTimeLeft(pet, now) > 0) return;
    AlbumSystem.instance.add(
      pet,
      'farewell',
      'Una nueva familia',
      `${pet.name} encontró una nueva familia que cuidará de su bienestar. Siempre te recordará.`,
    );
    const name = pet.name;
    this.remove(pet.id);
    EventBus.instance.emit('pet:lostForever', { petId: pet.id, name });
  }

  /** Probabilidad actual de encontrar a la mascota buscándola. */
  searchChance(pet: Pet): number {
    const e = GameConfig.ESCAPE;
    return Math.min(1, e.baseSearchChance + e.searchChancePerAttempt * pet.data.rescueAttempts);
  }

  /** Buscar por el vecindario (gratis, con cooldown y probabilidad creciente). */
  search(id: string): SearchResult {
    const pet = this.get(id);
    if (!pet || !pet.isEscaped) return { ok: false, reason: 'invalid' };
    const now = Clock.now();
    const e = GameConfig.ESCAPE;
    if (pet.data.lastSearchAt !== null && now - pet.data.lastSearchAt < e.searchCooldownMs) {
      return { ok: false, reason: 'cooldown', remainingMs: e.searchCooldownMs - (now - pet.data.lastSearchAt) };
    }
    const p = this.searchChance(pet);
    pet.data.lastSearchAt = now;
    if (chance(p)) {
      this.rescue(pet);
      return { ok: true };
    }
    pet.data.rescueAttempts++;
    return { ok: false, reason: 'notFound', chance: this.searchChance(pet) };
  }

  /** Recupera a la mascota (por búsqueda o con el Collar GPS). */
  rescue(pet: Pet): void {
    if (!pet.isEscaped) return;
    // Si ya hay 3 en casa (no debería, porque la escapada ocupa hueco) iría al rancho
    pet.data.location = PetLocation.Active;
    pet.data.escapedAt = null;
    pet.data.rescueAttempts = 0;
    Object.assign(pet.data.stats, {
      health: 50,
      hunger: Math.min(pet.stats.hunger, 50),
      happiness: Math.max(pet.stats.happiness, 30),
      hygiene: Math.max(pet.stats.hygiene, 30),
      energy: Math.max(pet.stats.energy, 50),
    });
    this.state.counters.rescues++;
    AlbumSystem.instance.add(pet, 'rescue', '¡De vuelta a casa!', `Encontraste a ${pet.name}. ¡Qué alegría!`);
    EventBus.instance.emit('pet:rescued', { petId: pet.id });
    EventBus.instance.emit('pet:statsChanged', { petId: pet.id });
  }

  private wrap(data: PetData): Pet {
    let pet = this.cache.get(data.id);
    if (!pet || pet.data !== data) {
      pet = new Pet(data);
      this.cache.set(data.id, pet);
    }
    return pet;
  }
}
