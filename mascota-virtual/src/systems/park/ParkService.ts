/**
 * ParkService (Singleton): parque virtual para socializar.
 *
 * Por ahora los visitantes son simulados en local. La interfaz `ParkNetwork`
 * es el punto de enganche para el multijugador real (servidor en tiempo real):
 * bastará con implementarla y asignarla a `ParkService.instance.network`.
 */
import { Clock } from '../../core/Clock';
import { EventBus } from '../../core/EventBus';
import { pick, randInt, seededRng } from '../../core/random';
import { DataRegistry } from '../../data/DataRegistry';
import { Feature } from '../../data/stages';
import { GrowthSystem } from '../growth/GrowthSystem';
import { PetManager } from '../pet/PetManager';
import { GrowthStage, Sex, type AccessorySlot, type PetGenes } from '../pet/PetTypes';

export interface ParkVisitor {
  id: string;
  name: string;
  ownerName: string;
  speciesId: string;
  sex: Sex;
  stage: GrowthStage;
  genes: PetGenes;
  equipped: Partial<Record<AccessorySlot, string>>;
  /** Posición en el parque (0-1). */
  x: number;
  y: number;
}

/** Contrato para un parque online (a implementar con un backend). */
export interface ParkNetwork {
  getVisitors(): ParkVisitor[];
}

export type ParkResult = { ok: true; message: string; happiness: number } | { ok: false; message: string };

const OWNERS = ['Carla', 'Iván', 'Noa', 'Bruno', 'Elena', 'Marcos', 'Julia', 'Teo'];
const ACCESSORIES: Record<AccessorySlot, string[]> = {
  head: ['acc_bow', 'acc_cap', 'acc_flower', 'acc_tophat'],
  face: ['acc_glasses', 'acc_monocle'],
  neck: ['acc_scarf', 'acc_bell'],
};
const VISIT_MS = 30 * 60 * 1000;

/** Visitantes simulados, estables durante cada franja de 30 minutos. */
class LocalParkNetwork implements ParkNetwork {
  getVisitors(): ParkVisitor[] {
    const slot = Math.floor(Clock.now() / VISIT_MS);
    const r = seededRng(slot * 7919);
    const at = <T>(list: readonly T[]) => list[Math.floor(r() * list.length)];
    const count = 4 + Math.floor(r() * 3);
    // Celdas de una cuadrícula 3x3 barajadas, para que no se amontonen
    const cells = Array.from({ length: 9 }, (_, i) => i).sort(() => r() - 0.5);
    return Array.from({ length: count }, (_, i) => {
      const species = at(DataRegistry.instance.allSpecies());
      const equipped: Partial<Record<AccessorySlot, string>> = {};
      (Object.keys(ACCESSORIES) as AccessorySlot[]).forEach((s) => {
        if (r() < 0.35) equipped[s] = at(ACCESSORIES[s]);
      });
      return {
        id: `visitor_${slot}_${i}`,
        name: at(species.nameSuggestions),
        ownerName: at(OWNERS),
        speciesId: species.id,
        sex: r() < 0.5 ? Sex.Male : Sex.Female,
        stage: at([GrowthStage.Juvenile, GrowthStage.Adult, GrowthStage.Adult, GrowthStage.Senior]),
        genes: {
          primaryColor: at(species.primaryPalette),
          secondaryColor: at(species.secondaryPalette),
          pattern: at(species.patterns),
          size: 0.9 + r() * 0.2,
          baseAgility: species.baseAgility,
          baseBeauty: species.baseBeauty,
        },
        equipped,
        x: ((cells[i] % 3) + 0.2 + r() * 0.6) / 3,
        y: (Math.floor(cells[i] / 3) + 0.1 + r() * 0.5) / 3,
      };
    });
  }
}

export class ParkService {
  private static _instance: ParkService | null = null;

  static get instance(): ParkService {
    if (!this._instance) this._instance = new ParkService();
    return this._instance;
  }

  network: ParkNetwork = new LocalParkNetwork();

  /** Quién ya saludó a quién en esta visita (no se guarda: se reinicia cada sesión). */
  private greeted = new Set<string>();

  visitors(): ParkVisitor[] {
    return this.network.getVisitors();
  }

  canVisit(petId: string): boolean {
    const pet = PetManager.instance.get(petId);
    return !!pet && pet.isActive && GrowthSystem.instance.isUnlocked(pet, Feature.Park);
  }

  /** Saludar a otra mascota: sube la felicidad (una vez por visitante). */
  greet(petId: string, visitorId: string): ParkResult {
    const pet = PetManager.instance.get(petId);
    if (!pet || !this.canVisit(petId)) return { ok: false, message: 'Aún no puede ir al parque' };
    if (pet.data.sleeping) return { ok: false, message: 'Está durmiendo' };
    const key = `${petId}:${visitorId}`;
    if (this.greeted.has(key)) return { ok: false, message: 'Ya se saludaron' };
    this.greeted.add(key);
    const visitor = this.visitors().find((v) => v.id === visitorId);
    const happiness = pet.modifyStat('happiness', randInt(6, 10));
    pet.modifyStat('energy', -3);
    EventBus.instance.emit('pet:statsChanged', { petId });
    const lines = ['¡Se olieron y ahora son amigos!', '¡Jugaron a perseguirse!', '¡Qué buena onda!'];
    return { ok: true, message: `${visitor?.name ?? 'Su nuevo amigo'}: ${pick(lines)}`, happiness };
  }
}
