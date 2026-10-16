/** Tienda: comprar comida, accesorios, muebles, aceleradores, medicina y especiales. */
import { EventBus } from '../../core/EventBus';
import type { ItemCategory } from '../../data/types';
import { EconomySystem } from '../../systems/economy/EconomySystem';
import { itemIcon, type Screen } from '../common';
import { esc, onAction, priceHTML } from '../dom';
import { GameState } from '../../core/GameState';
import { PRODUCTS, SEASONAL_EVENTS } from '../../data/premium';
import { StoreService } from '../../systems/economy/StoreService';
import { Analytics } from '../../systems/online/Analytics';
import { showToast } from '../Overlay';

type ShopTab = ItemCategory | 'premium';

const TABS: { id: ShopTab; label: string }[] = [
  { id: 'food', label: '🍖 Comida' },
  { id: 'premium', label: '💎 Premium' },
  { id: 'accessory', label: '🎀 Accesorios' },
  { id: 'furniture', label: '🛋️ Muebles' },
  { id: 'decor', label: '🖼️ Decoración' },
  { id: 'accelerator', label: '⏩ Crecimiento' },
  { id: 'medicine', label: '💊 Salud' },
  { id: 'special', label: '📡 Especial' },
];

export class ShopScreen implements Screen {
  id = 'shop';
  private root!: HTMLElement;
  private tab: ShopTab = 'food';
  private buying = false;
  private offs: (() => void)[] = [];

  mount(root: HTMLElement): void {
    this.root = root;
    onAction(root, (act, t) => {
      if (act === 'apply') {
        EconomySystem.instance.applyDecor(t.dataset.id!);
        this.render();
        return;
      }
      if (act === 'tab') {
        this.tab = t.dataset.id as ShopTab;
        if (this.tab === 'premium') Analytics.instance.track('premium_vista');
        this.render();
      } else if (act === 'iap-buy') {
        void this.buyProduct(t.dataset.id!);
      } else if (act === 'iap-restore') {
        void StoreService.instance.restore().then((n) => showToast(n ? `✅ ${n} compra(s) restaurada(s)` : 'No hay compras que restaurar', n ? 'good' : 'info'));
      } else if (act === 'event') {
        this.tab = 'decor';
        this.render();
      } else if (act === 'info') {
        // Muestra/oculta la explicación del objeto sobre su tarjeta
        const card = t.closest('.shop-card');
        root.querySelectorAll('.shop-card.show-info').forEach((c) => c !== card && c.classList.remove('show-info'));
        card?.classList.toggle('show-info');
      } else if (act === 'buy') {
        const r = EconomySystem.instance.buy(t.dataset.id!);
        if (r.ok) showToast('¡Comprado! 🛍️', 'good');
        else showToast(r.reason === 'funds' ? 'No te alcanza 😢' : r.reason === 'owned' ? 'Ya lo tienes' : 'No disponible', 'bad');
        this.render();
      }
    });
    this.offs = [
      EventBus.instance.on('economy:walletChanged', () => this.render()),
      EventBus.instance.on('store:changed', () => this.render()),
    ];
    this.render();
  }

  unmount(): void {
    this.offs.forEach((o) => o());
  }

  /** Tienda Premium: compras de Google Play, todo cosmético. */
  private premiumHTML(): string {
    const store = StoreService.instance;
    const owned = GameState.instance.data.entitlements;
    const cards = PRODUCTS.map((p) => {
      const tiene = owned.includes(p.id);
      const precio = store.prices[p.id];
      const boton = tiene
        ? '<button class="price-btn off" disabled>✔ Comprado</button>'
        : store.status === 'lista' && precio
          ? `<button class="price-btn premium-btn" data-act="iap-buy" data-id="${p.id}">${esc(precio)}</button>`
          : store.status === 'web'
            ? '<button class="price-btn off" disabled>Disponible en la app de Android</button>'
            : store.status === 'cargando'
              ? '<button class="price-btn off" disabled>Cargando…</button>'
              : '<button class="price-btn off" disabled>Próximamente</button>';
      return `<div class="premium-card ${tiene ? 'owned' : ''}">
        <div class="premium-head"><span class="premium-icon">${p.icon}</span><div><b>${esc(p.name)}</b><small>${esc(p.description)}</small></div></div>
        <div class="premium-items">${p.items.map((id) => itemIcon(id)).join('')}${p.stars ? `<span class="premium-stars">+${p.stars} ⭐</span>` : ''}</div>
        ${boton}
      </div>`;
    }).join('');
    return `<div class="premium-intro"><b>💎 Apoya a Patitas</b><p class="hint">Todo es cosmético y opcional: el juego completo es gratis y sin anuncios. Cada compra ayuda a crear más mascotas, eventos y decoración.</p></div>
      ${cards}
      ${store.status !== 'web' ? '<button class="btn btn-sm restore-btn" data-act="iap-restore">↻ Restaurar compras</button>' : ''}
      <p class="hint center">Los pagos los gestiona Google Play. Nosotros no recibimos tus datos de pago.</p>`;
  }

  private async buyProduct(id: string): Promise<void> {
    if (this.buying) return;
    this.buying = true;
    Analytics.instance.track('premium_click', id);
    try {
      const r = await StoreService.instance.buy(id);
      showToast(r === 'ok' ? '💖 ¡Gracias por apoyar Patitas! Ya tienes tu compra.' : '⏳ Tu pago está pendiente: se activará cuando se complete.', 'good');
    } catch {
      showToast('No se completó la compra. No se te ha cobrado nada.', 'bad');
    } finally {
      this.buying = false;
      this.render();
    }
  }

  render(): void {
    const eco = EconomySystem.instance;
    const tabsHTML = `<div class="tabs shop-tabs">${TABS.map((t) => `<button class="tab ${t.id === this.tab ? 'active' : ''} ${t.id === 'premium' ? 'tab-premium' : ''}" data-act="tab" data-id="${t.id}">${t.label}</button>`).join('')}</div>`;
    const ev = SEASONAL_EVENTS.find((e) => eco.eventActive(e.id));
    const banner = ev && this.tab !== 'premium'
      ? `<button class="event-banner" data-act="event"><span class="event-icon">${ev.icon}</span><span><b>Evento: ${esc(ev.name)}</b><small>${esc(ev.description)}</small></span></button>`
      : '';
    if (this.tab === 'premium') {
      this.root.innerHTML = tabsHTML + this.premiumHTML();
      return;
    }
    const items = eco.shopItems(this.tab as ItemCategory);
    this.root.innerHTML = `
      ${tabsHTML}
      ${banner}
      <div class="shop-grid">
        ${items
          .map((item) => {
            const owned = eco.owns(item.id);
            const qty = eco.quantity(item.id);
            const afford = eco.canAfford(item.price);
            const bonus = item.category === 'accessory' && item.beautyBonus ? `<span class="shop-bonus">+${item.beautyBonus} ✨</span>` : '';
            return `
              <div class="shop-card ${owned ? 'owned' : ''}" data-item="${item.id}">
                <button class="info-btn" data-act="info" data-id="${item.id}" aria-label="¿Para qué sirve?">?</button>
                ${qty && !owned ? `<span class="shop-qty">x${qty}</span>` : ''}
                <div class="shop-art">${itemIcon(item.id)}</div>
                <b class="shop-name">${esc(item.name)}</b>${bonus}
                ${item.decor && owned
                  ? (GameState.instance.data.decor[item.decor.slot] === item.id
                    ? '<button class="price-btn off" disabled>✔ Puesto</button>'
                    : `<button class="price-btn" data-act="apply" data-id="${item.id}">Poner</button>`)
                  : `<button class="price-btn ${afford && !owned ? '' : 'off'}" data-act="buy" data-id="${item.id}" ${owned || !afford ? 'disabled' : ''}>
                  ${owned ? '✔ Tuyo' : priceHTML(item.price)}
                </button>`}
                <div class="shop-info" data-act="info" data-id="${item.id}"><b>${esc(item.name)}</b><p>${esc(item.description)}</p><small>Toca para cerrar</small></div>
              </div>`;
          })
          .join('')}
      </div>
      <p class="hint center">Gana monedas con la recompensa diaria, compitiendo y cuidando a tus mascotas. Las ⭐ se consiguen en competencias, misiones y rachas. La decoración se ve en tu casa al momento.</p>`;
  }
}
