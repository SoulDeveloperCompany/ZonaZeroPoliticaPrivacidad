/**
 * AlbumSystem (Singleton): álbum de recuerdos con los momentos clave
 * (nacimiento, cambios de etapa, trofeos, crías, escapes...).
 * Se guarda dentro de la partida.
 */
import { Clock } from '../../core/Clock';
import { EventBus } from '../../core/EventBus';
import { GameState } from '../../core/GameState';
import { uid } from '../../core/random';
import type { Pet } from '../pet/Pet';
import type { GrowthStage, PetGenes } from '../pet/PetTypes';

export type MemoryKind =
  | 'birth'
  | 'stage'
  | 'wellCared'
  | 'competition'
  | 'trick'
  | 'breeding'
  | 'escape'
  | 'rescue'
  | 'farewell'
  | 'adoption';

export interface MemoryEntry {
  id: string;
  at: number;
  kind: MemoryKind;
  petId: string;
  petName: string;
  title: string;
  text: string;
  /** Foto: lo necesario para volver a dibujar a la mascota tal y como era. */
  snapshot: { speciesId: string; stage: GrowthStage; genes: PetGenes; equipped: Record<string, string> };
}

const KIND_ICONS: Record<MemoryKind, string> = {
  birth: '🐣',
  stage: '🌱',
  wellCared: '💖',
  competition: '🏆',
  trick: '🎯',
  breeding: '👶',
  escape: '💨',
  rescue: '🏠',
  farewell: '👋',
  adoption: '🤝',
};

export class AlbumSystem {
  private static _instance: AlbumSystem | null = null;

  static get instance(): AlbumSystem {
    if (!this._instance) this._instance = new AlbumSystem();
    return this._instance;
  }

  static iconFor(kind: MemoryKind): string {
    return KIND_ICONS[kind];
  }

  /** Añade un recuerdo con una "foto" del estado actual de la mascota. */
  add(pet: Pet, kind: MemoryKind, title: string, text: string): MemoryEntry {
    const entry: MemoryEntry = {
      id: uid('mem'),
      at: Clock.now(),
      kind,
      petId: pet.id,
      petName: pet.name,
      title,
      text,
      snapshot: {
        speciesId: pet.data.speciesId,
        stage: pet.data.stage,
        genes: { ...pet.data.genes },
        equipped: { ...(pet.data.equipped as Record<string, string>) },
      },
    };
    GameState.instance.data.album.push(entry);
    EventBus.instance.emit('album:added', { entry });
    return entry;
  }

  /** Recuerdos del más reciente al más antiguo (opcionalmente de una mascota). */
  list(petId?: string): MemoryEntry[] {
    const all = GameState.instance.data.album;
    return (petId ? all.filter((m) => m.petId === petId) : [...all]).sort((a, b) => b.at - a.at);
  }
}
