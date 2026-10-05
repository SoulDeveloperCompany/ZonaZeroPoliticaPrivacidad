/**
 * ParkService (Singleton): parque para socializar con mascotas de otros jugadores.
 * Muestra a quienes se conectaron en los últimos 30 minutos (datos del servidor).
 */
import { EventBus } from '../../core/EventBus';
import { pick, randInt } from '../../core/random';
import { DataRegistry } from '../../data/DataRegistry';
import { Feature } from '../../data/stages';
import { GrowthSystem } from '../growth/GrowthSystem';
import { OnlineService } from '../online/OnlineService';
import { PetManager } from '../pet/PetManager';
import { GrowthStage, STAGE_ORDER, type AccessorySlot, type PetGenes, type Sex } from '../pet/PetTypes';

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

export type ParkResult = { ok: true; message: string; happiness: number } | { ok: false; message: string };

export class ParkService {
  private static _instance: ParkService | null = null;

  static get instance(): ParkService {
    if (!this._instance) this._instance = new ParkService();
    return this._instance;
  }

  /** Quién ya saludó a quién en esta sesión. */
  private greeted = new Set<string>();
  private cache: ParkVisitor[] = [];

  /** Últimos visitantes cargados. */
  get visitors(): ParkVisitor[] {
    return this.cache;
  }

  /** Carga los jugadores conectados recientemente. */
  async load(): Promise<ParkVisitor[]> {
    const list = await OnlineService.instance.park();
    // Repartidos en una cuadrícula para que no se amontonen
    const cells = Array.from({ length: 16 }, (_, i) => i).sort(() => Math.random() - 0.5);
    this.cache = list.map((p, i) => {
      const sp = DataRegistry.instance.getSpecies(p.especie);
      const cell = cells[i % cells.length];
      return {
        id: p.id,
        name: p.nombre || 'Mascota',
        ownerName: p.apodo,
        speciesId: sp.id,
        sex: p.sexo,
        stage: STAGE_ORDER.includes(p.etapa as GrowthStage) ? (p.etapa as GrowthStage) : GrowthStage.Adult,
        genes: { primaryColor: sp.primaryPalette[0], secondaryColor: sp.secondaryPalette[0], pattern: 'plain', size: 1, baseAgility: 0, baseBeauty: 0, ...p.genes },
        equipped: p.accesorios ?? {},
        x: ((cell % 4) + 0.15 + Math.random() * 0.6) / 4,
        y: (Math.floor(cell / 4) + 0.1 + Math.random() * 0.5) / 4,
      };
    });
    return this.cache;
  }

  canVisit(petId: string): boolean {
    const pet = PetManager.instance.get(petId);
    return !!pet && pet.isActive && GrowthSystem.instance.isUnlocked(pet, Feature.Park);
  }

  /** Saludar a otra mascota: sube la felicidad (una vez por visitante y sesión). */
  greet(petId: string, visitorId: string): ParkResult {
    const pet = PetManager.instance.get(petId);
    if (!pet || !this.canVisit(petId)) return { ok: false, message: 'Aún no puede ir al parque' };
    if (pet.data.sleeping) return { ok: false, message: 'Está durmiendo' };
    const key = `${petId}:${visitorId}`;
    if (this.greeted.has(key)) return { ok: false, message: 'Ya se saludaron' };
    this.greeted.add(key);
    const visitor = this.cache.find((v) => v.id === visitorId);
    const happiness = pet.modifyStat('happiness', randInt(6, 10));
    pet.modifyStat('energy', -3);
    EventBus.instance.emit('pet:statsChanged', { petId });
    const lines = ['¡Se olieron y ahora son amigos!', '¡Jugaron a perseguirse!', '¡Qué buena onda!'];
    return { ok: true, message: `${visitor?.name ?? 'Su nuevo amigo'}: ${pick(lines)}`, happiness };
  }
}
