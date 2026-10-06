/**
 * BreedingSystem (Singleton): apareamiento, herencia, rancho y adopción.
 *
 * - Solo adultos (no senior), misma especie y sexo opuesto.
 * - La pareja puede ser otra mascota tuya o la de otro jugador real
 *   (publicada en el servidor; se paga su tarifa al dueño).
 * - La cría hereda color, patrón, tamaño y stats base de ambos padres con
 *   variación aleatoria y una pequeña probabilidad de mutación.
 * - Si ya tienes 3 mascotas en casa, la cría va al rancho.
 * - Las crías se pueden publicar en adopción para otros jugadores.
 */
import { Clock } from '../../core/Clock';
import { EventBus } from '../../core/EventBus';
import { GameConfig } from '../../core/GameConfig';
import { GameState } from '../../core/GameState';
import { chance, clamp, pick, randInt, rng } from '../../core/random';
import { DataRegistry } from '../../data/DataRegistry';
import { Feature } from '../../data/stages';
import { EconomySystem } from '../economy/EconomySystem';
import { GrowthSystem } from '../growth/GrowthSystem';
import { OnlineService, type RemoteAdoption, type RemotePartner } from '../online/OnlineService';
import { Pet } from '../pet/Pet';
import { PetManager } from '../pet/PetManager';
import { GrowthStage, PetLocation, Sex, type PetGenes } from '../pet/PetTypes';
import { AlbumSystem } from '../save/AlbumSystem';

export type BreedCheck =
  | { ok: true }
  | { ok: false; reason: 'stage' | 'happiness' | 'health' | 'cooldown' | 'unavailable'; daysLeft?: number };

/** Pareja: otra mascota tuya o la de otro jugador publicada en el servidor. */
export type Partner = { kind: 'own'; pet: Pet } | { kind: 'online'; listing: RemotePartner };

export type BreedResult = { ok: true; baby: Pet; location: PetLocation } | { ok: false; reason: string };

export type SimpleResult = { ok: true } | { ok: false; reason: string };

/** Tarifa por defecto al ofrecer una mascota como pareja. */
export const PARTNER_FEE = 100;

export class BreedingSystem {
  private static _instance: BreedingSystem | null = null;

  static get instance(): BreedingSystem {
    if (!this._instance) this._instance = new BreedingSystem();
    return this._instance;
  }

  private get online() {
    return OnlineService.instance;
  }

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

  /** Tus mascotas compatibles (sin conexión). */
  ownPartners(pet: Pet): Partner[] {
    return PetManager.instance
      .all()
      .filter((other) => this.compatible(pet.data, other.data) && this.canBreed(other).ok)
      .map((other) => ({ kind: 'own', pet: other }));
  }

  /**
   * Busca parejas: tus mascotas compatibles + las que otros jugadores ofrecen
   * en el servidor. `error` indica si no se pudo consultar el servidor.
   */
  async findPartners(pet: Pet): Promise<{ partners: Partner[]; error?: unknown }> {
    const own = this.ownPartners(pet);
    if (!this.online.isConfigured()) return { partners: own, error: new Error('sin-servidor') };
    try {
      const opposite = pet.data.sex === Sex.Male ? Sex.Female : Sex.Male;
      const remote = await this.online.listPartners(pet.data.speciesId, opposite);
      return { partners: [...own, ...remote.map((listing): Partner => ({ kind: 'online', listing }))] };
    } catch (error) {
      return { partners: own, error };
    }
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
  async breed(petId: string, partner: Partner, babyName = ''): Promise<BreedResult> {
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
      const l = partner.listing;
      if (l.especie !== pet.data.speciesId || l.sexo === pet.data.sex) return { ok: false, reason: 'No son compatibles' };
      // Se cobra antes y se devuelve si el servidor falla
      if (!EconomySystem.instance.pay({ coins: l.tarifa })) return { ok: false, reason: 'No tienes monedas suficientes' };
      try {
        const r = await this.online.usePartner(l.anuncio);
        partnerGenes = { ...Pet.randomGenes(DataRegistry.instance.getSpecies(l.especie)), ...l.genes, ...r.genes };
        partnerName = r.nombre || l.nombre;
      } catch (err) {
        EconomySystem.instance.addCoins(l.tarifa);
        return { ok: false, reason: OnlineService.describe(err) };
      }
      partnerId = l.anuncio;
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

  // ---------- Ofrecer como pareja a otros jugadores ----------

  async offerAsPartner(petId: string, fee = PARTNER_FEE): Promise<SimpleResult> {
    const pet = PetManager.instance.get(petId);
    if (!pet) return { ok: false, reason: 'Mascota no encontrada' };
    if (!GrowthSystem.instance.isUnlocked(pet, Feature.Breed)) return { ok: false, reason: 'Solo los adultos pueden ser pareja' };
    try {
      pet.data.partnerListingId = await this.online.publishPartner(pet, fee);
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: OnlineService.describe(err) };
    }
  }

  async withdrawPartner(petId: string): Promise<SimpleResult> {
    const pet = PetManager.instance.get(petId);
    if (!pet?.data.partnerListingId) return { ok: true };
    try {
      await this.online.withdrawPartner(pet.data.partnerListingId);
      pet.data.partnerListingId = null;
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: OnlineService.describe(err) };
    }
  }

  // ---------- Adopción pública (publicar tus crías) ----------

  /** Precio que pagará quien adopte (mejor cuidada = más monedas). */
  adoptionReward(pet: Pet): number {
    const stageBonus = pet.stage === GrowthStage.Baby ? 1.2 : 1;
    return Math.round((60 + pet.wellbeing * 0.8 + pet.data.genes.baseBeauty * 0.4) * stageBonus);
  }

  /** Publica una mascota en adopción en el servidor. No se puede publicar la única que tienes. */
  async listForAdoption(petId: string): Promise<SimpleResult> {
    const pet = PetManager.instance.get(petId);
    if (!pet || pet.isEscaped || pet.data.location === PetLocation.Adoption) return { ok: false, reason: 'No disponible' };
    const others = PetManager.instance.all().filter((p) => p.id !== petId && p.data.location !== PetLocation.Adoption);
    if (others.length === 0) return { ok: false, reason: 'No puedes dar en adopción a tu única mascota' };
    try {
      pet.data.adoptionOfferId = await this.online.publishAdoption(pet, this.adoptionReward(pet));
    } catch (err) {
      return { ok: false, reason: OnlineService.describe(err) };
    }
    const wasSelected = PetManager.instance.selected?.id === petId;
    pet.data.location = PetLocation.Adoption;
    pet.data.listedAt = Clock.now();
    pet.data.sleeping = false;
    if (wasSelected) PetManager.instance.select(PetManager.instance.homePets()[0]?.id ?? null);
    EventBus.instance.emit('pet:locationChanged', { petId });
    return { ok: true };
  }

  /** Retira la publicación: vuelve a casa si hay hueco, si no al rancho. */
  async cancelListing(petId: string): Promise<SimpleResult> {
    const pet = PetManager.instance.get(petId);
    if (!pet || pet.data.location !== PetLocation.Adoption) return { ok: true };
    if (pet.data.adoptionOfferId) {
      try {
        await this.online.withdrawAdoption(pet.data.adoptionOfferId);
      } catch (err) {
        // Si alguien ya la adoptó, la siguiente sincronización la entregará
        return { ok: false, reason: OnlineService.describe(err) };
      }
    }
    pet.data.location = PetManager.instance.hasFreeSlot() ? PetLocation.Active : PetLocation.Ranch;
    pet.data.listedAt = null;
    pet.data.adoptionOfferId = null;
    EventBus.instance.emit('pet:locationChanged', { petId });
    return { ok: true };
  }

  /**
   * Aplica lo que dijo el servidor al sincronizar: estas crías publicadas por
   * ti ya fueron adoptadas por otros jugadores (las monedas llegan aparte).
   */
  applyAdopted(list: { oferta: string; mascotaId: string; precio: number }[]): number {
    let n = 0;
    for (const item of list) {
      const pet =
        PetManager.instance.all().find((p) => p.data.adoptionOfferId === item.oferta) ?? PetManager.instance.get(item.mascotaId);
      if (!pet) continue;
      AlbumSystem.instance.add(pet, 'adoption', '¡Nueva familia!', `Otro jugador adoptó a ${pet.name} y te pagó ${item.precio} monedas.`);
      const name = pet.name;
      PetManager.instance.remove(pet.id);
      EventBus.instance.emit('adoption:completed', { petName: name, coins: Number(item.precio) || 0 });
      n++;
    }
    return n;
  }

  // ---------- Adoptar crías de otros jugadores ----------

  async adopt(offer: RemoteAdoption, name?: string): Promise<BreedResult> {
    if (!EconomySystem.instance.pay({ coins: offer.precio })) return { ok: false, reason: 'No te alcanza' };
    let cria;
    try {
      cria = await this.online.adopt(offer.oferta);
    } catch (err) {
      EconomySystem.instance.addCoins(offer.precio);
      return { ok: false, reason: OnlineService.describe(err) };
    }
    const species = DataRegistry.instance.getSpecies(cria.especie);
    const baby = Pet.create({
      name: name || cria.nombre,
      speciesId: species.id,
      now: Clock.now(),
      sex: cria.sexo,
      genes: { ...Pet.randomGenes(species), ...cria.genes },
    });
    const location = PetManager.instance.add(baby, 'adopted');
    AlbumSystem.instance.add(baby, 'birth', '¡Nuevo miembro!', `Adoptaste a ${baby.name} de ${offer.duenoApodo}.`);
    return { ok: true, baby, location };
  }
}
