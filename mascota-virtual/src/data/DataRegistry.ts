/**
 * DataRegistry (Singleton): catálogo central de todas las definiciones de datos.
 *
 * Funciona como la carpeta de ScriptableObjects en Unity: los sistemas piden
 * aquí la definición por id. Para ampliar el juego (nueva especie, item,
 * competencia...) basta con llamar a `register*` al arrancar.
 */
import type {
  ActionDefinition,
  CompetitionDefinition,
  ItemDefinition,
  SpeciesDefinition,
  StageDefinition,
} from './types';
import { SPECIES } from './species';
import { ITEMS } from './items';
import { COMPETITIONS } from './competitions';
import { STAGES } from './stages';
import { ACTIONS } from './actions';
import type { GrowthStage } from '../systems/pet/PetTypes';

export class DataRegistry {
  private static _instance: DataRegistry | null = null;

  static get instance(): DataRegistry {
    if (!this._instance) this._instance = new DataRegistry();
    return this._instance;
  }

  private species = new Map<string, SpeciesDefinition>();
  private items = new Map<string, ItemDefinition>();
  private competitions = new Map<string, CompetitionDefinition>();
  private actions = new Map<string, ActionDefinition>();
  private stages: StageDefinition[] = [];

  private constructor() {
    SPECIES.forEach((s) => this.registerSpecies(s));
    ITEMS.forEach((i) => this.registerItem(i));
    COMPETITIONS.forEach((c) => this.registerCompetition(c));
    ACTIONS.forEach((a) => this.registerAction(a));
    STAGES.forEach((s) => this.registerStage(s));
  }

  // ---------- Registro ----------
  registerSpecies(def: SpeciesDefinition): void {
    this.species.set(def.id, def);
  }
  registerItem(def: ItemDefinition): void {
    this.items.set(def.id, def);
  }
  registerCompetition(def: CompetitionDefinition): void {
    this.competitions.set(def.id, def);
  }
  registerAction(def: ActionDefinition): void {
    this.actions.set(def.id, def);
  }
  registerStage(def: StageDefinition): void {
    this.stages = [...this.stages.filter((s) => s.id !== def.id), def].sort(
      (a, b) => a.startDay - b.startDay,
    );
  }

  // ---------- Consulta ----------
  getSpecies(id: string): SpeciesDefinition {
    const def = this.species.get(id);
    if (!def) throw new Error(`Especie desconocida: ${id}`);
    return def;
  }
  allSpecies(): SpeciesDefinition[] {
    return [...this.species.values()];
  }

  getItem(id: string): ItemDefinition {
    const def = this.items.get(id);
    if (!def) throw new Error(`Item desconocido: ${id}`);
    return def;
  }
  hasItem(id: string): boolean {
    return this.items.has(id);
  }
  allItems(): ItemDefinition[] {
    return [...this.items.values()];
  }

  getCompetition(id: string): CompetitionDefinition {
    const def = this.competitions.get(id);
    if (!def) throw new Error(`Competencia desconocida: ${id}`);
    return def;
  }
  allCompetitions(): CompetitionDefinition[] {
    return [...this.competitions.values()];
  }

  getAction(id: string): ActionDefinition {
    const def = this.actions.get(id);
    if (!def) throw new Error(`Acción desconocida: ${id}`);
    return def;
  }
  allActions(): ActionDefinition[] {
    return [...this.actions.values()];
  }

  /** Etapas ordenadas por día de inicio. */
  allStages(): StageDefinition[] {
    return this.stages;
  }
  getStage(id: GrowthStage): StageDefinition {
    const def = this.stages.find((s) => s.id === id);
    if (!def) throw new Error(`Etapa desconocida: ${id}`);
    return def;
  }
}
