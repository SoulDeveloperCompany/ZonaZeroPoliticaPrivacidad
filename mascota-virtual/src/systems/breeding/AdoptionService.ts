/**
 * Servicio de adopción pública.
 *
 * Está detrás de una
 * interfaz para cambiarlo más adelante por un backend online (Firebase,
 * Supabase...) sin tocar el resto del juego.
 */
import { GameState } from '../../core/GameState';
import type { Price } from '../../data/types';
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

/**
 * Implementación local: todavía no hay servidor, así que nadie más puede
 * publicar crías. El centro de adopción queda vacío hasta conectar el
 * multijugador (bastará con implementar `AdoptionService` contra el backend).
 */
export class LocalAdoptionService implements AdoptionService {
  getOffers(): AdoptionOffer[] {
    const state = GameState.instance.data;
    // Limpia ofertas simuladas que pudieran venir de partidas antiguas
    if (state.adoptionOffers.length) state.adoptionOffers = [];
    return state.adoptionOffers;
  }

  takeOffer(id: string): AdoptionOffer | null {
    const state = GameState.instance.data;
    const offer = state.adoptionOffers.find((o) => o.id === id) ?? null;
    state.adoptionOffers = state.adoptionOffers.filter((o) => o.id !== id);
    return offer;
  }
}
