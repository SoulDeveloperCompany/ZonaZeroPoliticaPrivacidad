/**
 * StoreService (Singleton): compras de Google Play (Play Billing Library 9 vía @capgo/native-purchases,
 * el mismo plugin que Mi Zoológico).
 *
 * - Solo en la app de Android. En la web/artefacto la tienda Premium dice "Disponible en la app".
 * - Productos de compra única (no consumibles) definidos en data/premium.ts → PRODUCTS.
 * - Al arrancar se revisan las compras ya hechas (reinstalar el juego o cambiar de móvil no las pierde).
 * - No enviamos nada de las compras a nuestro servidor: Google gestiona el pago.
 */
import { Capacitor } from '@capacitor/core';
import { NativePurchases, PURCHASE_TYPE, type Transaction } from '@capgo/native-purchases';
import { EventBus } from '../../core/EventBus';
import { PRODUCTS } from '../../data/premium';
import { EconomySystem } from './EconomySystem';

export type StoreStatus = 'web' | 'cargando' | 'lista' | 'sin-productos' | 'error';

export class StoreService {
  private static _instance: StoreService | null = null;

  static get instance(): StoreService {
    if (!this._instance) this._instance = new StoreService();
    return this._instance;
  }

  status: StoreStatus = Capacitor.isNativePlatform() ? 'cargando' : 'web';
  /** Precio real de Google Play por producto (p. ej. "2,99 €"). */
  prices: Record<string, string> = {};
  private started = false;

  get available(): boolean {
    return this.status === 'lista';
  }

  /** Conecta con Google Play: precios, compras previas y avisos de compras pendientes. */
  async start(): Promise<void> {
    if (this.started || !Capacitor.isNativePlatform()) return;
    this.started = true;
    try {
      await NativePurchases.addListener('transactionUpdated', (t) => this.onTransaction(t));
      const { products } = await NativePurchases.getProducts({ productIdentifiers: PRODUCTS.map((p) => p.id), productType: PURCHASE_TYPE.INAPP });
      for (const p of products ?? []) if (p.priceString) this.prices[p.identifier] = p.priceString;
      this.status = Object.keys(this.prices).length ? 'lista' : 'sin-productos';
      await this.checkOwned();
    } catch {
      this.status = 'error';
    }
    EventBus.instance.emit('store:changed', { status: this.status });
  }

  /** Revisa las compras ya hechas y las activa (sirve también para "Restaurar compras"). */
  async checkOwned(): Promise<number> {
    if (!Capacitor.isNativePlatform()) return 0;
    const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP });
    let n = 0;
    for (const t of purchases ?? []) if (this.onTransaction(t)) n++;
    return n;
  }

  async restore(): Promise<number> {
    if (!Capacitor.isNativePlatform()) return 0;
    try {
      await NativePurchases.restorePurchases();
    } catch {
      /* se revisa igual abajo */
    }
    return this.checkOwned();
  }

  /** Compra un producto. Devuelve 'ok', 'pendiente' (pago en curso) o lanza un error. */
  async buy(productId: string): Promise<'ok' | 'pendiente'> {
    const t = await NativePurchases.purchaseProduct({
      productIdentifier: productId,
      productType: PURCHASE_TYPE.INAPP,
      isConsumable: false,
      autoAcknowledgePurchases: true,
    });
    if (!t?.purchaseState || t.purchaseState === '1') {
      this.onTransaction({ ...t, productIdentifier: t?.productIdentifier ?? productId, purchaseState: '1' } as Transaction);
      return 'ok';
    }
    return 'pendiente';
  }

  /** Activa lo comprado. purchaseState '1' = pagado (Android). */
  private onTransaction(t: Transaction): boolean {
    if (!t || (t.purchaseState && t.purchaseState !== '1')) return false;
    const ok = EconomySystem.instance.grantEntitlement(t.productIdentifier);
    if (ok) EventBus.instance.emit('store:granted', { productId: t.productIdentifier });
    return ok;
  }
}
