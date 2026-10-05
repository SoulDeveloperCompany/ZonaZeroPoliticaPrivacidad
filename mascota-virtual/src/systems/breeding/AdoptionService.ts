/**
 * Servicio de adopción pública.
 *
 * Hoy funciona en local simulando a otros jugadores. Está detrás de una
 * interfaz para cambiarlo más adelante por un backend online (Firebase,
 * Supabase...) sin tocar el resto del juego.
 */
import { Clock } from '../../core/Clock';
import { GameState } from '../../core/GameState';
import { pick, randInt, rng, uid } from '../../core/random';
import { DataRegistry } from '../../data/DataRegistry';
import type { Price } from '../../data/types';
import { Pet } from '../pet/Pet';
import { Sex, type PetGenes } from '../pet/PetTypes';

/** Una cría publicada por otro jugador. */
export interface AdoptionOffer {
  id: string;
  name: string;
  speciesId: string;
  sex: Sex;
  genes: PetGenes;
  ownerName: string;
  price: Price;
}

export interface AdoptionService {
  /** Crías disponibles para adoptar. */
  getOffers(): AdoptionOffer[];
  /** Retira una oferta (cuando el jugador la adopta). */
  takeOffer(id: string): AdoptionOffer | null;
}

const OWNER_NAMES = ['Sofía', 'Mateo', 'Valentina', 'Lucas', 'Camila', 'Diego', 'Isabella', 'Leo'];
const REFRESH_MS = 2 * 60 * 60 * 1000;

/** Implementación local: genera ofertas que se renuevan cada 2 horas. */
export class LocalAdoptionService implements AdoptionService {
  getOffers(): AdoptionOffer[] {
    const state = GameState.instance.data;
    const now = Clock.now();
    if (now >= state.adoptionRefreshAt || state.adoptionOffers.length === 0) {
      state.adoptionOffers = Array.from({ length: 3 }, () => this.generateOffer());
      state.adoptionRefreshAt = now + REFRESH_MS;
    }
    return state.adoptionOffers;
  }

  takeOffer(id: string): AdoptionOffer | null {
    const state = GameState.instance.data;
    const offer = state.adoptionOffers.find((o) => o.id === id) ?? null;
    state.adoptionOffers = state.adoptionOffers.filter((o) => o.id !== id);
    return offer;
  }

  private generateOffer(): AdoptionOffer {
    const species = pick(DataRegistry.instance.allSpecies());
    const premium = rng() < 0.25;
    return {
      id: uid('offer'),
      name: pick(species.nameSuggestions),
      speciesId: species.id,
      sex: rng() < 0.5 ? Sex.Male : Sex.Female,
      genes: Pet.randomGenes(species),
      ownerName: pick(OWNER_NAMES),
      price: premium ? { stars: randInt(3, 5) } : { coins: randInt(15, 25) * 10 },
    };
  }
}
