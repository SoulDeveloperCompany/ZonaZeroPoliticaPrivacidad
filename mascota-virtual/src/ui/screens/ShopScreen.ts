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
      <div class="shop-list">
        ${items
          .map((item) => {
            const owned = eco.owns(item.id);
            const qty = eco.quantity(item.id);
            const afford = eco.canAfford(item.price);
            const extra =
              item.category === 'accessory' && item.beautyBonus ? ` · +${item.beautyBonus} ✨` : qty && !owned ? ` · tienes ${qty}` : '';
            return `
              <div class="shop-item ${owned ? 'owned' : ''}">
                ${itemIcon(item.id)}
                <div class="shop-info"><b>${esc(item.name)}</b><small>${esc(item.description)}${extra}</small></div>
                <button class="btn btn-buy ${afford && !owned ? 'btn-primary' : ''}" data-act="buy" data-id="${item.id}" ${owned || !afford ? 'disabled' : ''}>
                  ${owned ? '✔ Tuyo' : priceHTML(item.price)}
                </button>
              </div>`;
          })
          .join('')}
      </div>
      <p class="hint center">Gana monedas con la recompensa diaria, compitiendo y cuidando a tus mascotas. Las ⭐ se consiguen en competencias.</p>`;
  }
}
