/** Tienda: comprar comida, accesorios, muebles, aceleradores, medicina y especiales. */
import { EventBus } from '../../core/EventBus';
import type { ItemCategory } from '../../data/types';
import { EconomySystem } from '../../systems/economy/EconomySystem';
import { itemIcon, type Screen } from '../common';
import { esc, onAction, priceHTML } from '../dom';
import { showToast } from '../Overlay';

const TABS: { id: ItemCategory; label: string }[] = [
  { id: 'food', label: '🍖 Comida' },
  { id: 'accessory', label: '🎀 Accesorios' },
  { id: 'furniture', label: '🛋️ Muebles' },
  { id: 'accelerator', label: '⏩ Crecimiento' },
  { id: 'medicine', label: '💊 Salud' },
  { id: 'special', label: '📡 Especial' },
];

export class ShopScreen implements Screen {
  id = 'shop';
  private root!: HTMLElement;
  private tab: ItemCategory = 'food';
  private offs: (() => void)[] = [];

  mount(root: HTMLElement): void {
    this.root = root;
    onAction(root, (act, t) => {
      if (act === 'tab') {
        this.tab = t.dataset.id as ItemCategory;
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
    this.offs = [EventBus.instance.on('economy:walletChanged', () => this.render())];
    this.render();
  }

  unmount(): void {
    this.offs.forEach((o) => o());
  }

  render(): void {
    const eco = EconomySystem.instance;
    const items = eco.shopItems(this.tab);
    this.root.innerHTML = `
      <div class="tabs">${TABS.map((t) => `<button class="tab ${t.id === this.tab ? 'active' : ''}" data-act="tab" data-id="${t.id}">${t.label}</button>`).join('')}</div>
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
                <button class="price-btn ${afford && !owned ? '' : 'off'}" data-act="buy" data-id="${item.id}" ${owned || !afford ? 'disabled' : ''}>
                  ${owned ? '✔ Tuyo' : priceHTML(item.price)}
                </button>
                <div class="shop-info" data-act="info" data-id="${item.id}"><b>${esc(item.name)}</b><p>${esc(item.description)}</p><small>Toca para cerrar</small></div>
              </div>`;
          })
          .join('')}
      </div>
      <p class="hint center">Gana monedas con la recompensa diaria, compitiendo y cuidando a tus mascotas. Las ⭐ se consiguen en competencias.</p>`;
  }
}
