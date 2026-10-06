/**
 * EconomySystem (Singleton): monedas, estrellas, inventario y tienda.
 *
 * - Monedas: moneda común (recompensa diaria, competencias, interacciones).
 * - Estrellas: moneda premium que se gana compitiendo bien.
 * - Accesorios: se equipan en la mascota y se ven en su sprite.
 * - Muebles: se colocan en casa y dan bonus pasivos.
 */
import { Clock } from '../../core/Clock';
import { EventBus } from '../../core/EventBus';
import { GameConfig } from '../../core/GameConfig';
import { GameState } from '../../core/GameState';
import { DataRegistry } from '../../data/DataRegistry';
import type { ItemCategory, ItemDefinition, Price, StatDeltas } from '../../data/types';
import { GrowthSystem } from '../growth/GrowthSystem';
import { PetManager } from '../pet/PetManager';
import { STAGE_ORDER } from '../pet/PetTypes';

export type BuyResult = { ok: true } | { ok: false; reason: 'funds' | 'owned' | 'invalid' };

export type UseResult =
  | { ok: true; message: string; deltas?: StatDeltas }
  | { ok: false; reason: 'noItem' | 'invalid' | 'stage' | 'notApplicable'; message: string };

export class EconomySystem {
  private static _instance: EconomySystem | null = null;

  static get instance(): EconomySystem {
    if (!this._instance) this._instance = new EconomySystem();
    return this._instance;
  }

  private get state() {
    return GameState.instance.data;
  }

  // ---------- Monedero ----------

  get coins(): number {
    return this.state.wallet.coins;
  }
  get stars(): number {
    return this.state.wallet.stars;
  }

  addCoins(n: number): void {
    this.state.wallet.coins = Math.max(0, this.state.wallet.coins + Math.round(n));
    this.emitWallet();
  }

  addStars(n: number): void {
    this.state.wallet.stars = Math.max(0, this.state.wallet.stars + Math.round(n));
    this.emitWallet();
  }

  canAfford(price: Price): boolean {
    return this.coins >= (price.coins ?? 0) && this.stars >= (price.stars ?? 0);
  }

  /** Cobra un precio. Devuelve false (sin cobrar nada) si no alcanza. */
  pay(price: Price): boolean {
    if (!this.canAfford(price)) return false;
    this.state.wallet.coins -= price.coins ?? 0;
    this.state.wallet.stars -= price.stars ?? 0;
    this.emitWallet();
    return true;
  }

  private emitWallet(): void {
    EventBus.instance.emit('economy:walletChanged', { coins: this.coins, stars: this.stars });
  }

  // ---------- Inventario ----------

  quantity(itemId: string): number {
    return this.state.inventory[itemId] ?? 0;
  }

  addItem(itemId: string, qty = 1): void {
    this.state.inventory[itemId] = this.quantity(itemId) + qty;
    EventBus.instance.emit('economy:inventoryChanged', { itemId, quantity: this.quantity(itemId) });
  }

  /** Gasta una unidad de un item. */
  consume(itemId: string): boolean {
    const q = this.quantity(itemId);
    if (q <= 0) return false;
    if (q === 1) delete this.state.inventory[itemId];
    else this.state.inventory[itemId] = q - 1;
    EventBus.instance.emit('economy:inventoryChanged', { itemId, quantity: q - 1 });
    return true;
  }

  /** Items del inventario de una categoría (las comidas gratis siempre aparecen). */
  inventoryBy(category: ItemCategory): { item: ItemDefinition; quantity: number }[] {
    return DataRegistry.instance
      .allItems()
      .filter((i) => i.category === category && (i.free || this.quantity(i.id) > 0))
      .map((item) => ({ item, quantity: item.free ? Infinity : this.quantity(item.id) }));
  }

  /** ¿Ya tiene este accesorio o mueble? (no se compran dos veces). */
  owns(itemId: string): boolean {
    const item = DataRegistry.instance.getItem(itemId);
    if (item.category === 'furniture') return this.state.furniture.includes(itemId);
    if (item.category === 'accessory') return this.quantity(itemId) > 0;
    return false;
  }

  // ---------- Tienda ----------

  /** Items en venta de una categoría. */
  shopItems(category: ItemCategory): ItemDefinition[] {
    return DataRegistry.instance.allItems().filter((i) => i.category === category && !i.free);
  }

  buy(itemId: string): BuyResult {
    if (!DataRegistry.instance.hasItem(itemId)) return { ok: false, reason: 'invalid' };
    const item = DataRegistry.instance.getItem(itemId);
    if (item.free) return { ok: false, reason: 'invalid' };
    if (this.owns(itemId)) return { ok: false, reason: 'owned' };
    if (!this.pay(item.price)) return { ok: false, reason: 'funds' };
    if (item.category === 'furniture') {
      this.state.furniture.push(itemId); // los muebles se colocan solos en casa
    } else {
      this.addItem(itemId);
    }
    EventBus.instance.emit('economy:purchase', { itemId });
    return { ok: true };
  }

  // ---------- Usar items ----------

  /** Usa un item consumible (medicina, acelerador, especial) sobre una mascota. */
  useItem(petId: string, itemId: string): UseResult {
    const pet = PetManager.instance.get(petId);
    const item = DataRegistry.instance.hasItem(itemId) ? DataRegistry.instance.getItem(itemId) : null;
    if (!pet || !item) return { ok: false, reason: 'invalid', message: 'Objeto no válido' };
    if (this.quantity(itemId) <= 0) return { ok: false, reason: 'noItem', message: 'No te queda' };
    if (item.minStage && STAGE_ORDER.indexOf(pet.stage) < STAGE_ORDER.indexOf(item.minStage)) {
      return { ok: false, reason: 'stage', message: 'Todavía es muy pequeño para esto' };
    }

    // Collar GPS: solo sirve para mascotas escapadas
    if (item.rescuesPet) {
      if (!pet.isEscaped) return { ok: false, reason: 'notApplicable', message: 'No se ha escapado' };
      this.consume(itemId);
      PetManager.instance.rescue(pet);
      return { ok: true, message: `¡El GPS encontró a ${pet.name}!` };
    }

    if (!pet.isActive) return { ok: false, reason: 'notApplicable', message: 'No está en casa' };

    if (item.growthDays) {
      this.consume(itemId);
      GrowthSystem.instance.addDays(pet, item.growthDays);
      return { ok: true, message: `+${item.growthDays} día de edad` };
    }
    if (item.growthBoostMs) {
      this.consume(itemId);
      GrowthSystem.instance.addBoost(pet, item.growthBoostMs);
      return { ok: true, message: 'Crecimiento x2 activado' };
    }
    if (item.effects) {
      this.consume(itemId);
      const deltas = pet.applyDeltas(item.effects);
      EventBus.instance.emit('pet:statsChanged', { petId: pet.id });
      return { ok: true, message: `Usaste ${item.name}`, deltas };
    }
    return { ok: false, reason: 'notApplicable', message: 'Este objeto no se usa así' };
  }

  // ---------- Accesorios ----------

  /**
   * Equipa un accesorio. Cada accesorio es único: si otra mascota lo lleva,
   * se le quita primero.
   */
  equip(petId: string, itemId: string): boolean {
    const pet = PetManager.instance.get(petId);
    const item = DataRegistry.instance.getItem(itemId);
    if (!pet || item.category !== 'accessory' || !item.slot || this.quantity(itemId) <= 0) return false;
    for (const other of PetManager.instance.all()) {
      if (other.data.equipped[item.slot] === itemId) delete other.data.equipped[item.slot];
    }
    pet.data.equipped[item.slot] = itemId;
    EventBus.instance.emit('pet:statsChanged', { petId });
    return true;
  }

  unequip(petId: string, itemId: string): void {
    const pet = PetManager.instance.get(petId);
    if (!pet) return;
    for (const [slot, id] of Object.entries(pet.data.equipped)) {
      if (id === itemId) delete pet.data.equipped[slot as keyof typeof pet.data.equipped];
    }
    EventBus.instance.emit('pet:statsChanged', { petId });
  }

  // ---------- Regalos del servidor ----------

  /**
   * Entrega un regalo: monedas, estrellas y un objeto opcional (si el id existe).
   * Devuelve el nombre del objeto entregado (o null).
   */
  giveGift(gift: { monedas: number; estrellas: number; objeto: string; cantidad: number }): string | null {
    if (gift.monedas > 0) this.addCoins(gift.monedas);
    if (gift.estrellas > 0) this.addStars(gift.estrellas);
    if (!gift.objeto || !DataRegistry.instance.hasItem(gift.objeto)) return null;
    const item = DataRegistry.instance.getItem(gift.objeto);
    if (item.free) return null;
    if (item.category === 'furniture') {
      if (!this.state.furniture.includes(item.id)) this.state.furniture.push(item.id);
      EventBus.instance.emit('economy:purchase', { itemId: item.id });
    } else if (item.category === 'accessory') {
      if (this.quantity(item.id) === 0) this.addItem(item.id, 1);
    } else {
      this.addItem(item.id, Math.max(1, gift.cantidad));
    }
    return item.name;
  }

  // ---------- Recompensa diaria ----------

  private dayKey(ms: number): string {
    const d = new Date(ms);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  canClaimDaily(): boolean {
    return this.state.daily.lastClaimDay !== this.dayKey(Clock.now());
  }

  /** Cobra la recompensa diaria; la racha sube si se reclamó ayer. */
  claimDaily(): { coins: number; stars: number; streak: number } | null {
    if (!this.canClaimDaily()) return null;
    const now = Clock.now();
    const yesterday = this.dayKey(now - 24 * 60 * 60 * 1000);
    const cfg = GameConfig.DAILY_BONUS;
    const streak = this.state.daily.lastClaimDay === yesterday ? (this.state.daily.streak % cfg.maxStreak) + 1 : 1;
    const coins = cfg.baseCoins + cfg.streakCoins * (streak - 1);
    const stars = streak === cfg.starOnDay ? 1 : 0;
    this.state.daily = { lastClaimDay: this.dayKey(now), streak };
    this.addCoins(coins);
    if (stars) this.addStars(stars);
    return { coins, stars, streak };
  }
}
