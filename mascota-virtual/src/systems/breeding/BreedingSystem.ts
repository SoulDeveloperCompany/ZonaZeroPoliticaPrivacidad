/**
 * BreedingSystem (Singleton): apareamiento, herencia, rancho y adopción.
 *
 * - Solo adultos (no senior), misma especie y sexo opuesto.
 * - La pareja puede ser otra mascota tuya o una de otro jugador (simulada, con tarifa).
 * - La cría hereda color, patrón, tamaño y stats base de ambos padres con
 *   variación aleatoria y una pequeña probabilidad de mutación.
 * - Si ya tienes 3 mascotas en casa, la cría va al rancho.
 * - Las crías se pueden publicar en adopción pública.
 */
import { Clock } from '../../core/Clock';
import { EventBus } from '../../core/EventBus';
import { GameConfig } from '../../core/GameConfig';
import { GameState } from '../../core/GameState';
import { chance, clamp, pick, randInt, rng, seededRng } from '../../core/random';
import { DataRegistry } from '../../data/DataRegistry';
import { Feature } from '../../data/stages';
import { EconomySystem } from '../economy/EconomySystem';
import { GrowthSystem } from '../growth/GrowthSystem';
import { Pet } from '../pet/Pet';
import { PetManager } from '../pet/PetManager';
import { GrowthStage, PetLocation, Sex, type PetGenes } from '../pet/PetTypes';
import { AlbumSystem } from '../save/AlbumSystem';
import { LocalAdoptionService, type AdoptionService } from './AdoptionService';

export type BreedCheck =
  | { ok: true }
  | { ok: false; reason: 'stage' | 'happiness' | 'health' | 'cooldown' | 'unavailable'; daysLeft?: number };

/** Pareja candidata de otro jugador (simulada). */
export interface NpcPartner {
  id: string;
  name: string;
  ownerName: string;
  speciesId: string;
  sex: Sex;
  genes: PetGenes;
  fee: number;
}

export type Partner = { kind: 'own'; pet: Pet } | { kind: 'npc'; npc: NpcPartner };

export type BreedResult =
  | { ok: true; baby: Pet; location: PetLocation }
  | { ok: false; reason: string };

const NPC_NAMES = ['Duque', 'Princesa', 'Canelo', 'Estrella', 'Bruno', 'Perla', 'Thor', 'Miel'];
const OWNERS = ['Ana', 'Pablo', 'Lucía', 'Hugo', 'Martina', 'Álvaro'];

export class BreedingSystem {
  private static _instance: BreedingSystem | null = null;

  static get instance(): BreedingSystem {
    if (!this._instance) this._instance = new BreedingSystem();
    return this._instance;
  }

  /** Servicio de adopción intercambiable (local hoy, online mañana). */
  adoption: AdoptionService = new LocalAdoptionService();

  // ---------- Apareamiento ----------

  canBreed(pet: Pet): BreedCheck {
    const cfg = GameConfig.BREEDING;
    if (pet.data.location !== PetLocation.Active && pet.data.location !== PetLocation.Ranch) {
      return { ok: false, reason: 'unavailable' };
    }
    if (!GrowthSystem.instance.isUnlocked(pet, Feature.Breed)) return { ok: false, reason: 'stage' };
    if (pet.stats.happiness < cfg.minHappiness) return { ok: false, reason: 'happiness' };
    if (pet.stats.health < cfg.minHealth) return { ok: false, reason: 'health' };
    if (pet.data.lastBredAtDay !== null) {
      const daysLeft = pet.data.lastBredAtDay + cfg.cooldownDays - pet.data.ageDays;
      if (daysLeft > 0) return { ok: false, reason: 'cooldown', daysLeft };
    }
    return { ok: true };
  }

  /** Misma especie y sexo opuesto. */
  compatible(a: { speciesId: string; sex: Sex; id: string }, b: { speciesId: string; sex: Sex; id: string }): boolean {
    return a.id !== b.id && a.speciesId === b.speciesId && a.sex !== b.sex;
  }

  /** Busca parejas: tus mascotas compatibles + candidatas de otros jugadores. */
  findPartners(pet: Pet): Partner[] {
    const own: Partner[] = PetManager.instance
      .all()
      .filter((other) => this.compatible(pet.data, other.data) && this.canBreed(other).ok)
      .map((other) => ({ kind: 'own', pet: other }));
    return [...own, ...this.npcPartners(pet).map((npc): Partner => ({ kind: 'npc', npc }))];
  }

  /**
   * Candidatas simuladas de otros jugadores. Son estables durante el mismo
   * día de juego (misma semilla) para que no cambien cada vez que abres la pantalla.
   */
  npcPartners(pet: Pet): NpcPartner[] {
    const species = pet.species;
    const day = Math.floor(Clock.now() / (6 * 60 * 60 * 1000));
    const seed = [...pet.id].reduce((acc, c) => acc + c.charCodeAt(0), day);
    const r = seededRng(seed);
    const at = <T>(list: readonly T[]) => list[Math.floor(r() * list.length)];
    const opposite = pet.data.sex === Sex.Male ? Sex.Female : Sex.Male;
    return Array.from({ length: 3 }, (_, i) => ({
      id: `npc_${seed}_${i}`,
      name: at(NPC_NAMES),
      ownerName: at(OWNERS),
      speciesId: species.id,
      sex: opposite,
      genes: {
        primaryColor: at(species.primaryPalette),
        secondaryColor: at(species.secondaryPalette),
        pattern: at(species.patterns),
        size: Math.round((0.9 + r() * 0.2) * 100) / 100,
        baseAgility: clamp(Math.round(species.baseAgility + (r() - 0.3) * 20)),
        baseBeauty: clamp(Math.round(species.baseBeauty + (r() - 0.3) * 20)),
      },
      fee: GameConfig.BREEDING.npcPartnerFee + i * 40,
    }));
  }

  /** Genes de la cría: mezcla aleatoria de ambos padres + mutación ocasional. */
  inheritGenes(a: PetGenes, b: PetGenes, speciesId: string): PetGenes {
    const species = DataRegistry.instance.getSpecies(speciesId);
    const mutate = GameConfig.BREEDING.mutationChance;
    const fromParent = <T>(x: T, y: T) => (rng() < 0.5 ? x : y);
    return {
      primaryColor: chance(mutate) ? pick(species.primaryPalette) : fromParent(a.primaryColor, b.primaryColor),
      secondaryColor: chance(mutate) ? pick(species.secondaryPalette) : fromParent(a.secondaryColor, b.secondaryColor),
      pattern: chance(mutate) ? pick(species.patterns) : fromParent(a.pattern, b.pattern),
      size: Math.round(clamp((a.size + b.size) / 2 + (rng() - 0.5) * 0.1, 0.85, 1.15) * 100) / 100,
      baseAgility: clamp(Math.round((a.baseAgility + b.baseAgility) / 2 + randInt(-8, 8))),
      baseBeauty: clamp(Math.round((a.baseBeauty + b.baseBeauty) / 2 + randInt(-8, 8))),
    };
  }

  /** Aparea a una mascota con una pareja. La cría nace como bebé. */
  breed(petId: string, partner: Partner, babyName = ''): BreedResult {
    const pet = PetManager.instance.get(petId);
    if (!pet) return { ok: false, reason: 'Mascota no encontrada' };
    const check = this.canBreed(pet);
    if (!check.ok) return { ok: false, reason: this.describe(check) };

    let partnerGenes: PetGenes;
    let partnerName: string;
    let partnerId: string;
    let partnerGeneration = 1;

    if (partner.kind === 'own') {
      const other = partner.pet;
      if (!this.compatible(pet.data, other.data)) return { ok: false, reason: 'No son compatibles' };
      const otherCheck = this.canBreed(other);
      if (!otherCheck.ok) return { ok: false, reason: `${other.name}: ${this.describe(otherCheck)}` };
      partnerGenes = other.data.genes;
      partnerName = other.name;
      partnerId = other.id;
      partnerGeneration = other.data.generation;
      other.data.lastBredAtDay = other.data.ageDays;
    } else {
      const npc = partner.npc;
      if (!this.compatible(pet.data, npc)) return { ok: false, reason: 'No son compatibles' };
      if (!EconomySystem.instance.pay({ coins: npc.fee })) return { ok: false, reason: 'No tienes monedas suficientes' };
      partnerGenes = npc.genes;
      partnerName = npc.name;
      partnerId = npc.id;
    }

    pet.data.lastBredAtDay = pet.data.ageDays;
    pet.modifyStat('energy', -20);

    const genes = this.inheritGenes(pet.data.genes, partnerGenes, pet.data.speciesId);
    const baby = Pet.create({
      name: babyName,
      speciesId: pet.data.speciesId,
      now: Clock.now(),
      genes,
      generation: Math.max(pet.data.generation, partnerGeneration) + 1,
      parents: [pet.name, partnerName],
    });
    const location = PetManager.instance.add(baby, 'born');
    GameState.instance.data.counters.births++;

    AlbumSystem.instance.add(baby, 'birth', '¡Ha nacido!', `Cría de ${pet.name} y ${partnerName}. Generación ${baby.data.generation}.`);
    AlbumSystem.instance.add(pet, 'breeding', '¡Nueva cría!', `${pet.name} y ${partnerName} tuvieron a ${baby.name}.`);
    EventBus.instance.emit('breeding:born', { babyId: baby.id, parentA: pet.id, parentB: partnerId });
    return { ok: true, baby, location };
  }

  describe(check: Extract<BreedCheck, { ok: false }>): string {
    switch (check.reason) {
      case 'stage':
        return 'Solo los adultos pueden tener crías';
      case 'happiness':
        return 'Necesita estar más feliz';
      case 'health':
        return 'Necesita más salud';
      case 'cooldown':
        return `Necesita descansar ${Math.ceil(check.daysLeft ?? 0)} día(s)`;
      default:
        return 'No disponible';
    }
  }

  // ---------- Adopción pública (publicar tus crías) ----------

  /** Publica una mascota en adopción. No se puede publicar la única que tienes. */
  listForAdoption(petId: string): boolean {
    const pet = PetManager.instance.get(petId);
    if (!pet || pet.isEscaped || pet.data.location === PetLocation.Adoption) return false;
    const others = PetManager.instance
      .all()
      .filter((p) => p.id !== petId && p.data.location !== PetLocation.Adoption);
    if (others.length === 0) return false;
    const wasSelected = PetManager.instance.selected?.id === petId;
    pet.data.location = PetLocation.Adoption;
    pet.data.listedAt = Clock.now();
    pet.data.sleeping = false;
    if (wasSelected) PetManager.instance.select(PetManager.instance.homePets()[0]?.id ?? null);
    EventBus.instance.emit('pet:locationChanged', { petId });
    return true;
  }

  /** Retira la publicación: vuelve a casa si hay hueco, si no al rancho. */
  cancelListing(petId: string): void {
    const pet = PetManager.instance.get(petId);
    if (!pet || pet.data.location !== PetLocation.Adoption) return;
    pet.data.location = PetManager.instance.hasFreeSlot() ? PetLocation.Active : PetLocation.Ranch;
    pet.data.listedAt = null;
    EventBus.instance.emit('pet:locationChanged', { petId });
  }

  /** Recompensa que da la familia adoptante (mejor cuidada = más monedas). */
  adoptionReward(pet: Pet): number {
    const stageBonus = pet.stage === GrowthStage.Baby ? 1.2 : 1;
    return Math.round((60 + pet.wellbeing * 0.8 + pet.data.genes.baseBeauty * 0.4) * stageBonus);
  }

  /** Revisa las publicaciones y completa las adopciones que ya tocan. */
  update(now = Clock.now()): void {
    for (const pet of PetManager.instance.byLocation(PetLocation.Adoption)) {
      if (pet.data.listedAt === null || now - pet.data.listedAt < GameConfig.ADOPTION_WAIT_MS) continue;
      const coins = this.adoptionReward(pet);
      EconomySystem.instance.addCoins(coins);
      AlbumSystem.instance.add(pet, 'adoption', '¡Nueva familia!', `Una familia adoptó a ${pet.name} y te regaló ${coins} monedas.`);
      const name = pet.name;
      PetManager.instance.remove(pet.id);
      EventBus.instance.emit('adoption:completed', { petName: name, coins });
    }
  }

  // ---------- Adoptar crías de otros ----------

  /** Adopta una cría publicada por otro jugador. */
  adopt(offerId: string, name?: string): BreedResult {
    const offer = this.adoption.getOffers().find((o) => o.id === offerId);
    if (!offer) return { ok: false, reason: 'Ya no está disponible' };
    if (!EconomySystem.instance.pay(offer.price)) return { ok: false, reason: 'No te alcanza' };
    this.adoption.takeOffer(offerId);
    const baby = Pet.create({
      name: name || offer.name,
      speciesId: offer.speciesId,
      now: Clock.now(),
      sex: offer.sex,
      genes: offer.genes,
    });
    const location = PetManager.instance.add(baby, 'adopted');
    AlbumSystem.instance.add(baby, 'birth', '¡Nuevo miembro!', `Adoptaste a ${baby.name} de ${offer.ownerName}.`);
    return { ok: true, baby, location };
  }
}

