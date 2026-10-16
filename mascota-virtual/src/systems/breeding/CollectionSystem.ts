/**
 * CollectionSystem (Singleton): libro de pelajes (Auditoría P11).
 *
 * Cada especie tiene 5 colores normales y 2 RAROS que solo pueden salir criando
 * (ver BreedingSystem.inheritGenes). Al tener una mascota de un color nuevo se apunta en el libro.
 * Completar una especie (7/7) da 5 ⭐. Es la meta de largo plazo para jugadores veteranos.
 */
import { EventBus } from '../../core/EventBus';
import { GameState } from '../../core/GameState';
import { DataRegistry } from '../../data/DataRegistry';
import { EconomySystem } from '../economy/EconomySystem';
import { AlbumSystem } from '../save/AlbumSystem';
import type { Pet } from '../pet/Pet';
import { PetManager } from '../pet/PetManager';

export const SPECIES_COMPLETE_STARS = 5;

export interface CollectionRow {
  speciesId: string;
  name: string;
  icon: string;
  colors: { color: string; rare: boolean; found: boolean }[];
}

export class CollectionSystem {
  private static _instance: CollectionSystem | null = null;

  static get instance(): CollectionSystem {
    if (!this._instance) this._instance = new CollectionSystem();
    return this._instance;
  }

  private started = false;

  private get state() {
    return GameState.instance.data;
  }

  /** Apunta en silencio las mascotas que ya tienes y escucha las nuevas. */
  start(): void {
    PetManager.instance.all().forEach((p) => this.register(p, true));
    if (this.started) return;
    this.started = true;
    EventBus.instance.on('pet:created', ({ petId, reason }) => {
      const pet = PetManager.instance.get(petId);
      if (pet) this.register(pet, reason === 'start'); // la primera mascota se apunta sin aviso
    });
  }

  static isRare(speciesId: string, color: string): boolean {
    return (DataRegistry.instance.getSpecies(speciesId).rarePalette ?? []).includes(color);
  }

  /** Registra el color de una mascota. Devuelve true si era nuevo. */
  register(pet: Pet, silencioso = false): boolean {
    const sp = pet.data.speciesId;
    const color = pet.data.genes.primaryColor;
    const lista = (this.state.collection[sp] ??= []);
    if (lista.includes(color)) return false;
    lista.push(color);
    const rare = CollectionSystem.isRare(sp, color);
    if (!silencioso) {
      AlbumSystem.instance.add(pet, 'first', rare ? '✨ ¡Pelaje raro descubierto!' : '📖 Nuevo pelaje en la colección', `${pet.name} añadió un color nuevo a tu libro de pelajes.`);
      EventBus.instance.emit('collection:new', { petId: pet.id, rare });
    }
    this.checkComplete(sp);
    return true;
  }

  private checkComplete(speciesId: string): void {
    const row = this.rows().find((r) => r.speciesId === speciesId);
    if (!row || !row.colors.every((c) => c.found) || this.state.collectionRewards.includes(speciesId)) return;
    this.state.collectionRewards.push(speciesId);
    EconomySystem.instance.addStars(SPECIES_COMPLETE_STARS);
    EventBus.instance.emit('ui:toast', { text: `📖 ¡Colección de ${row.name} completa! +${SPECIES_COMPLETE_STARS} ⭐`, kind: 'good' });
  }

  rows(): CollectionRow[] {
    return DataRegistry.instance.allSpecies().map((s) => {
      const found = new Set(this.state.collection[s.id] ?? []);
      return {
        speciesId: s.id,
        name: s.name,
        icon: s.icon,
        colors: [
          ...s.primaryPalette.map((color) => ({ color, rare: false, found: found.has(color) })),
          ...(s.rarePalette ?? []).map((color) => ({ color, rare: true, found: found.has(color) })),
        ],
      };
    });
  }

  progress(): { found: number; total: number } {
    const all = this.rows().flatMap((r) => r.colors);
    return { found: all.filter((c) => c.found).length, total: all.length };
  }

  /** Título de criador según lo descubierto (se ve en la colección). */
  title(): string {
    const { found, total } = this.progress();
    const p = found / total;
    return p >= 1 ? '🏆 Gran maestro criador' : p >= 0.75 ? '🥇 Maestro criador' : p >= 0.5 ? '🥈 Criador experto' : p >= 0.25 ? '🥉 Criador aprendiz' : '🐣 Criador novato';
  }
}
