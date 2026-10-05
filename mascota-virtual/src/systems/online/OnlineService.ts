/**
 * OnlineService (Singleton): única puerta de entrada al servidor.
 *
 * Hoy habla con una hoja de Google mediante Apps Script (server/patitas-apps-script.js).
 * Para cambiar a otro backend (Firebase, Supabase...) basta con reescribir este archivo:
 * el resto del juego solo usa estos métodos.
 */
import { Clock } from '../../core/Clock';
import { EventBus, toast } from '../../core/EventBus';
import { GameState } from '../../core/GameState';
import { OnlineConfig } from '../../core/OnlineConfig';
import { pick } from '../../core/random';
import type { Pet } from '../pet/Pet';
import type { AccessorySlot, PetGenes, Sex } from '../pet/PetTypes';

/** Mascota tal como viaja al servidor. */
export interface RemotePet {
  nombre: string;
  especie: string;
  etapa?: string;
  sexo: Sex;
  /** Puede venir incompleto desde el servidor: se completa con valores de la especie. */
  genes: Partial<PetGenes>;
  accesorios?: Partial<Record<AccessorySlot, string>>;
}

export interface RemoteAdoption extends RemotePet {
  oferta: string;
  duenoApodo: string;
  precio: number;
}
export interface RemotePartner extends RemotePet {
  anuncio: string;
  duenoApodo: string;
  tarifa: number;
}
export interface RemoteParkPet extends RemotePet {
  id: string;
  apodo: string;
}
export interface RankingRow {
  apodo: string;
  mascota: string;
  especie: string;
  puntaje: number;
  estrellas: number;
  yo: boolean;
}

/** Transporte HTTP (se puede sustituir en tests). */
export type Transport = (method: 'GET' | 'POST', url: string, payload: Record<string, unknown>) => Promise<any>;

const fetchTransport: Transport = async (method, url, payload) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), OnlineConfig.TIMEOUT_MS);
  try {
    let res: Response;
    if (method === 'GET') {
      const qs = new URLSearchParams(payload as Record<string, string>).toString();
      res = await fetch(`${url}?${qs}`, { signal: ctrl.signal, cache: 'no-store' });
    } else {
      // Sin cabecera Content-Type para que sea una petición "simple" (sin preflight CORS),
      // igual que hace Mi Zoológico con Apps Script.
      res = await fetch(url, { method: 'POST', body: JSON.stringify(payload), signal: ctrl.signal });
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
};

const APODO_A = ['Patita', 'Bigote', 'Colita', 'Huellita', 'Orejita', 'Pelusa', 'Hocico', 'Plumita', 'Garrita', 'Mimito'];
const APODO_B = ['Feliz', 'Veloz', 'Valiente', 'Curiosa', 'Brillante', 'Risueña', 'Audaz', 'Dorada', 'Sabia', 'Tierna'];

export class OnlineService {
  private static _instance: OnlineService | null = null;

  static get instance(): OnlineService {
    if (!this._instance) this._instance = new OnlineService();
    return this._instance;
  }

  transport: Transport = fetchTransport;
  /** Estado de la última petición (para mostrarlo en Ajustes). */
  status: 'sin-configurar' | 'ok' | 'error' = 'sin-configurar';

  private get state() {
    return GameState.instance.data;
  }

  get url(): string {
    return (this.state.online.url || OnlineConfig.DEFAULT_URL).trim();
  }

  isConfigured(): boolean {
    return /^https:\/\/script\.google(usercontent)?\.com\//.test(this.url);
  }

  setUrl(url: string): void {
    this.state.online.url = url.trim();
    this.status = this.isConfigured() ? 'ok' : 'sin-configurar';
  }

  /** Id y apodo del jugador (se crean la primera vez). */
  get player(): { id: string; apodo: string } {
    const p = this.state.player;
    if (!p.id) p.id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
    if (!p.apodo) p.apodo = OnlineService.randomApodo();
    return p;
  }

  static randomApodo(): string {
    return `${pick(APODO_A)} ${pick(APODO_B)} ${100 + Math.floor(Math.random() * 900)}`;
  }

  changeApodo(): string {
    this.state.player.apodo = OnlineService.randomApodo();
    return this.state.player.apodo;
  }

  static toRemote(pet: Pet): RemotePet & { mascotaId: string } {
    return {
      mascotaId: pet.id,
      nombre: pet.name,
      especie: pet.data.speciesId,
      etapa: pet.stage,
      sexo: pet.data.sex,
      genes: pet.data.genes,
      accesorios: pet.data.equipped,
    };
  }

  // ---------- Peticiones ----------

  private async call(method: 'GET' | 'POST', payload: Record<string, unknown>): Promise<any> {
    if (!this.isConfigured()) {
      this.status = 'sin-configurar';
      throw new Error('sin-servidor');
    }
    const { id, apodo } = this.player;
    try {
      const res = await this.transport(method, this.url, method === 'GET' ? { ...payload, id } : { ...payload, id, apodo });
      this.status = 'ok';
      if (res && res.ok === false) throw new Error(res.error || 'rechazado');
      return res;
    } catch (err) {
      if ((err as Error).message !== 'rechazado' && (err as Error).message !== 'no-disponible') this.status = 'error';
      throw err;
    }
  }

  /** Sube la mascota principal y recibe monedas pendientes y crías adoptadas. */
  async sync(main: Pet | undefined): Promise<{ monedas: number; adoptadas: { oferta: string; mascotaId: string; precio: number }[] }> {
    const res = await this.call('POST', { accion: 'sincronizar', mascota: main ? OnlineService.toRemote(main) : null });
    this.state.online.lastSync = Clock.now();
    return { monedas: Number(res.monedas) || 0, adoptadas: res.adoptadas ?? [] };
  }

  async publishAdoption(pet: Pet, precio: number): Promise<string> {
    return (await this.call('POST', { accion: 'publicarAdopcion', cria: OnlineService.toRemote(pet), precio })).oferta;
  }
  async withdrawAdoption(oferta: string): Promise<void> {
    await this.call('POST', { accion: 'retirarAdopcion', oferta });
  }
  async listAdoptions(): Promise<RemoteAdoption[]> {
    return (await this.call('GET', { accion: 'adopciones' })).lista ?? [];
  }
  async adopt(oferta: string): Promise<RemotePet & { duenoApodo: string }> {
    return (await this.call('POST', { accion: 'adoptar', oferta })).cria;
  }

  async publishPartner(pet: Pet, tarifa: number): Promise<string> {
    return (await this.call('POST', { accion: 'publicarPareja', mascota: OnlineService.toRemote(pet), tarifa })).anuncio;
  }
  async withdrawPartner(anuncio: string): Promise<void> {
    await this.call('POST', { accion: 'retirarPareja', anuncio });
  }
  async listPartners(especie: string, sexo: Sex): Promise<RemotePartner[]> {
    return (await this.call('GET', { accion: 'parejas', especie, sexo })).lista ?? [];
  }
  async usePartner(anuncio: string): Promise<{ nombre: string; genes: Partial<PetGenes> }> {
    return await this.call('POST', { accion: 'usarPareja', anuncio });
  }

  async submitScore(competencia: string, puntaje: number, estrellas: number, pet: Pet): Promise<void> {
    await this.call('POST', { accion: 'puntaje', competencia, puntaje: Math.round(puntaje), estrellas, mascota: pet.name, especie: pet.data.speciesId });
  }
  async ranking(competencia: string): Promise<{ lista: RankingRow[]; posicion: number; total: number }> {
    const r = await this.call('GET', { accion: 'ranking', competencia });
    return { lista: r.lista ?? [], posicion: r.posicion ?? 0, total: r.total ?? 0 };
  }

  async park(): Promise<RemoteParkPet[]> {
    return (await this.call('GET', { accion: 'parque' })).lista ?? [];
  }

  /** Mensaje amigable para un error de red. */
  static describe(err: unknown): string {
    const m = (err as Error)?.message;
    if (m === 'sin-servidor') return 'Conecta el servidor en ⚙️ Ajustes › Servidor';
    if (m === 'no-disponible') return 'Ya no está disponible';
    return 'Sin conexión con el servidor. Inténtalo más tarde';
  }
}

/** Avisa en pantalla de un error de red sin romper el flujo. */
export function onlineError(err: unknown): void {
  toast(OnlineService.describe(err), 'bad');
  EventBus.instance.emit('online:status', { status: OnlineService.instance.status });
}
