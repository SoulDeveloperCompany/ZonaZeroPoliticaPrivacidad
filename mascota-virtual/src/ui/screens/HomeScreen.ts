/**
 * Pantalla principal: la casa con la mascota seleccionada, sus stats,
 * la barra de crecimiento y los botones de cuidado.
 */
import { Clock, formatDuration } from '../../core/Clock';
import { EventBus } from '../../core/EventBus';
import { GameState } from '../../core/GameState';
import { DataRegistry } from '../../data/DataRegistry';
import { EconomySystem } from '../../systems/economy/EconomySystem';
import { GrowthSystem } from '../../systems/growth/GrowthSystem';
import { InteractionSystem, describeFailure } from '../../systems/interaction/InteractionSystem';
import { PetManager } from '../../systems/pet/PetManager';
import type { Pet } from '../../systems/pet/Pet';
import { STAT_KEYS, type PetStatKey } from '../../systems/pet/PetTypes';
import {
  STAT_ICONS,
  itemIcon,
  petSVG,
  sexIcon,
  spriteKey,
  stageName,
  statBarHTML,
  updateStatBars,
  type Screen,
} from '../common';
import { el, esc, onAction } from '../dom';
import { showModal, showToast } from '../Overlay';

/** Partículas que acompañan a cada animación. */
const PARTICLES: Record<string, string[]> = {
  eat: ['🍖', '😋', '✨'],
  bounce: ['⚽', '🎉', '💛'],
  wiggle: ['💖', '💕', '❤️'],
  bath: ['🫧', '🫧', '💧'],
  spin: ['⭐', '✨', '🎯'],
  walk: ['🌳', '🦋', '🌼'],
  sleep: ['🌙', '💤', '⭐'],
};

/** Dónde se dibuja cada mueble en la habitación (% izquierda, % arriba). */
const FURNITURE_POS: Record<string, [number, number]> = {
  furn_bed: [6, 64],
  furn_ball: [80, 70],
  furn_tub: [76, 40],
  furn_plant: [6, 22],
  furn_tv: [42, 6],
};

export class HomeScreen implements Screen {
  id = 'home';
  private root!: HTMLElement;
  private lastSprite = '';
  private offs: (() => void)[] = [];

  mount(root: HTMLElement): void {
    this.root = root;
    onAction(root, (act, t) => this.handle(act, t));
    const bus = EventBus.instance;
    const rerender = () => this.render();
    this.offs = [
      bus.on('pet:activeChanged', rerender),
      bus.on('pet:escaped', rerender),
      bus.on('pet:rescued', rerender),
      bus.on('pet:created', rerender),
      bus.on('pet:removed', rerender),
      bus.on('pet:locationChanged', rerender),
      bus.on('pet:stageChanged', rerender),
      bus.on('economy:purchase', rerender),
      bus.on('interaction:performed', (e) => this.feedback(e.animation, e.deltas, e.message, e.coinsFound)),
      bus.on('pet:statsChanged', () => this.tick()),
    ];
    this.render();
  }

  unmount(): void {
    this.offs.forEach((off) => off());
  }

  private get pet(): Pet | undefined {
    return PetManager.instance.selected;
  }

  // ---------- Render ----------

  render(): void {
    const pet = this.pet;
    const home = PetManager.instance.homePets();
    const tabs = home
      .map(
        (p) => `<button class="pet-tab ${p.id === pet?.id ? 'active' : ''}" data-act="select" data-id="${p.id}">
          <span class="pet-tab-sprite">${petSVG(p)}</span><span>${esc(p.name)}</span></button>`,
      )
      .join('');

    if (!pet) {
      this.root.innerHTML = `<div class="pet-tabs">${tabs}</div><div class="empty">No hay mascotas en casa. Trae una del rancho en <b>Familia</b>.</div>`;
      return;
    }

    this.root.innerHTML = `
      <div class="pet-tabs">${tabs}</div>
      <div class="room">
        ${this.furnitureHTML()}
        <div class="pet-name">${esc(pet.name)} ${sexIcon(pet.data.sex)} <span class="tag">${stageName(pet)}</span></div>
        <div class="pet-stage-wrap"><div class="pet-sprite" data-act="pet-touch"></div></div>
        <div class="fx-layer"></div>
      </div>
      ${pet.isEscaped ? this.escapedHTML(pet) : this.careHTML(pet)}
    `;
    this.lastSprite = '';
    this.tick();
  }

  private furnitureHTML(): string {
    return GameState.instance.data.furniture
      .map((id) => {
        const [x, y] = FURNITURE_POS[id] ?? [50, 70];
        return `<span class="furniture" style="left:${x}%;top:${y}%">${DataRegistry.instance.getItem(id).icon}</span>`;
      })
      .join('');
  }

  private careHTML(pet: Pet): string {
    const actions = DataRegistry.instance
      .allActions()
      .map(
        (a) => `<button class="action" data-act="action" data-id="${a.id}">
          <span class="action-icon">${a.icon}</span><span class="action-name">${a.name}</span>
          <span class="action-cd"></span></button>`,
      )
      .join('');
    return `
      <div class="growth">
        <div class="growth-label"></div>
        <div class="bar bar-growth"><div class="bar-fill"></div></div>
      </div>
      <div class="stats">${STAT_KEYS.map((k) => statBarHTML(k, pet.stats[k])).join('')}</div>
      <div class="actions">${actions}
        <button class="action" data-act="backpack"><span class="action-icon">🎒</span><span class="action-name">Mochila</span></button>
      </div>`;
  }

  private escapedHTML(pet: Pet): string {
    return `
      <div class="card escaped">
        <h3>💨 ¡${esc(pet.name)} se ha escapado!</h3>
        <p>Le faltaron cuidados y se fue de casa. Nunca está en peligro, pero si no das con su rastro a tiempo se quedará con otra familia.</p>
        <p class="escape-timer"></p>
        <button class="btn btn-primary" data-act="search">🔎 Buscar por el barrio</button>
        <button class="btn" data-act="gps">📡 Usar Collar GPS (${EconomySystem.instance.quantity('special_gps')})</button>
        <p class="hint search-hint"></p>
      </div>`;
  }

  // ---------- Actualización periódica ----------

  tick(): void {
    const pet = this.pet;
    if (!pet || !this.root) return;
    const sprite = this.root.querySelector<HTMLElement>('.pet-sprite');
    if (sprite) {
      if (pet.isEscaped) {
        sprite.innerHTML = '<div class="escaped-sign">🏚️<br/><small>Casa vacía...</small></div>';
      } else {
        const key = spriteKey(pet);
        if (key !== this.lastSprite) {
          sprite.innerHTML = petSVG(pet);
          this.lastSprite = key;
        }
      }
    }

    if (pet.isEscaped) {
      const left = PetManager.instance.escapeTimeLeft(pet);
      const timer = this.root.querySelector('.escape-timer');
      if (timer) timer.textContent = `⏳ Tiempo restante: ${formatDuration(left)}`;
      const hint = this.root.querySelector('.search-hint');
      if (hint) {
        const last = pet.data.lastSearchAt;
        const cd = last ? Math.max(0, last + 15 * 60 * 1000 - Clock.now()) : 0;
        hint.textContent =
          (cd > 0 ? `Puedes volver a buscar en ${formatDuration(cd)}. ` : '') +
          `Probabilidad de éxito: ${Math.round(PetManager.instance.searchChance(pet) * 100)}%`;
      }
      return;
    }

    const values: Partial<Record<PetStatKey, number>> = { ...pet.stats, beauty: pet.effectiveBeauty };
    updateStatBars(this.root, values);

    // Barra de crecimiento
    const g = GrowthSystem.instance.progress(pet);
    const label = this.root.querySelector('.growth-label');
    const fill = this.root.querySelector<HTMLElement>('.bar-growth .bar-fill');
    if (label && fill) {
      const boost = GrowthSystem.instance.growthMultiplier(pet, Clock.now()) > 1 ? ' ⏩x2' : '';
      label.innerHTML = g.next
        ? `<b>${g.current.name}</b> → ${g.next.name} · faltan ${formatDuration(g.daysLeft * 3600_000)}${boost} <span class="hint">(día ${pet.data.ageDays.toFixed(1)})</span>`
        : `<b>${g.current.name}</b> · día ${pet.data.ageDays.toFixed(1)}`;
      fill.style.width = `${Math.round(g.progress * 100)}%`;
    }

    // Estado de los botones (bloqueado / cooldown)
    const now = Clock.now();
    this.root.querySelectorAll<HTMLElement>('.action[data-act="action"]').forEach((btn) => {
      const id = btn.dataset.id!;
      const blocked = InteractionSystem.instance.check(pet, id, now);
      const cd = btn.querySelector('.action-cd')!;
      btn.classList.toggle('blocked', !!blocked);
      btn.classList.toggle('locked', blocked?.ok === false && blocked.reason === 'locked');
      cd.textContent =
        blocked?.ok === false && blocked.reason === 'cooldown'
          ? `${Math.ceil((blocked.remainingMs ?? 0) / 1000)}s`
          : blocked?.ok === false && blocked.reason === 'locked'
            ? '🔒'
            : '';
      if (id === 'sleep') {
        btn.querySelector('.action-name')!.textContent = pet.data.sleeping ? 'Despertar' : 'Dormir';
        btn.querySelector('.action-icon')!.textContent = pet.data.sleeping ? '☀️' : '🌙';
      }
    });
  }

  // ---------- Acciones ----------

  private handle(act: string, t: HTMLElement): void {
    const pet = this.pet;
    switch (act) {
      case 'select':
        PetManager.instance.select(t.dataset.id!);
        return;
      case 'pet-touch':
        if (pet?.isActive) this.doAction(pet, 'pet');
        return;
      case 'action':
        if (pet) this.doAction(pet, t.dataset.id!);
        return;
      case 'backpack':
        if (pet) openBackpack(pet);
        return;
      case 'search': {
        if (!pet) return;
        const r = PetManager.instance.search(pet.id);
        if (r.ok) showToast(`¡Encontraste a ${pet.name}! 🏠`, 'good');
        else if (r.reason === 'cooldown') showToast(`Descansa un poco. Vuelve a buscar en ${formatDuration(r.remainingMs)}`);
        else if (r.reason === 'notFound') showToast('No había rastro... ¡pero estás más cerca!', 'bad');
        this.tick();
        return;
      }
      case 'gps': {
        if (!pet) return;
        if (EconomySystem.instance.quantity('special_gps') <= 0) {
          showToast('No tienes Collar GPS. Cómpralo en la Tienda (Especial).', 'bad');
          return;
        }
        const r = EconomySystem.instance.useItem(pet.id, 'special_gps');
        showToast(r.message, r.ok ? 'good' : 'bad');
        return;
      }
    }
  }

  private doAction(pet: Pet, actionId: string): void {
    if (actionId === 'feed') {
      const blocked = InteractionSystem.instance.check(pet, 'feed');
      if (blocked && !blocked.ok) {
        showToast(describeFailure(blocked), 'bad');
        return;
      }
      openFoodPicker(pet);
      return;
    }
    const r = InteractionSystem.instance.perform(pet.id, actionId);
    if (!r.ok) showToast(describeFailure(r), 'bad');
  }

  /** Animación + partículas + textos flotantes tras una interacción. */
  private feedback(animation: string, deltas: Partial<Record<PetStatKey, number>>, message?: string, coins?: number): void {
    const sprite = this.root.querySelector<HTMLElement>('.pet-sprite');
    const fx = this.root.querySelector<HTMLElement>('.fx-layer');
    if (!sprite || !fx) return;
    sprite.classList.remove(...[...sprite.classList].filter((c) => c.startsWith('anim-')));
    void sprite.offsetWidth; // reinicia la animación CSS
    sprite.classList.add(`anim-${animation}`);
    setTimeout(() => sprite.classList.remove(`anim-${animation}`), 1200);

    (PARTICLES[animation] ?? ['✨']).forEach((p, i) => {
      for (let k = 0; k < 2; k++) {
        const node = el('span', 'particle', p);
        node.style.left = `${30 + Math.random() * 40}%`;
        node.style.animationDelay = `${(i * 2 + k) * 90}ms`;
        fx.appendChild(node);
        setTimeout(() => node.remove(), 1800);
      }
    });

    const lines: string[] = [];
    if (message) lines.push(esc(message));
    for (const [k, v] of Object.entries(deltas) as [PetStatKey, number][]) {
      if (Math.abs(v) >= 1) lines.push(`${v > 0 ? '+' : ''}${Math.round(v)} ${STAT_ICONS[k]}`);
    }
    if (coins) lines.push(`+${coins} 🪙`);
    lines.forEach((text, i) => {
      const node = el('span', 'float-text', text);
      node.style.top = `${18 + i * 9}%`;
      node.style.animationDelay = `${i * 120}ms`;
      fx.appendChild(node);
      setTimeout(() => node.remove(), 2000);
    });
  }
}

/** Elegir comida para alimentar. */
export function openFoodPicker(pet: Pet): void {
  const foods = EconomySystem.instance.inventoryBy('food');
  const fav = pet.species.favoriteFoods;
  const body = `<div class="item-grid">${foods
    .map(
      ({ item, quantity }) => `<button class="item-card" data-act="food" data-id="${item.id}">
        ${itemIcon(item.id)}<b>${esc(item.name)}</b>
        <small>${quantity === Infinity ? '∞' : `x${quantity}`}${fav.includes(item.id) ? ' · 😍 favorita' : ''}</small></button>`,
    )
    .join('')}</div><p class="hint">Compra más comida en la Tienda.</p>`;
  showModal({
    title: `¿Qué le das a ${esc(pet.name)}?`,
    body,
    buttons: [{ label: 'Cancelar', act: 'close' }],
    onAction: (act, t, modal) => {
      if (act !== 'food') return;
      const r = InteractionSystem.instance.perform(pet.id, 'feed', { itemId: t.dataset.id });
      if (!r.ok) showToast(describeFailure(r), 'bad');
      modal.close();
    },
  });
}

/** Mochila: usar medicinas/aceleradores y equipar accesorios. */
export function openBackpack(pet: Pet): void {
  const eco = EconomySystem.instance;
  const render = () => {
    const usable = [...eco.inventoryBy('medicine'), ...eco.inventoryBy('accelerator'), ...eco.inventoryBy('special')];
    const accessories = eco.inventoryBy('accessory');
    const equipped = Object.values(pet.data.equipped);
    return `
      <h4>Objetos</h4>
      ${usable.length ? `<div class="item-grid">${usable
        .map(
          ({ item, quantity }) => `<button class="item-card" data-act="use" data-id="${item.id}">
            ${itemIcon(item.id)}<b>${esc(item.name)}</b><small>x${quantity} · ${esc(item.description)}</small></button>`,
        )
        .join('')}</div>` : '<p class="hint">No tienes objetos. ¡Visita la tienda!</p>'}
      <h4>Accesorios</h4>
      ${accessories.length ? `<div class="item-grid">${accessories
        .map(({ item }) => {
          const on = equipped.includes(item.id);
          return `<button class="item-card ${on ? 'equipped' : ''}" data-act="equip" data-id="${item.id}">
            ${itemIcon(item.id)}<b>${esc(item.name)}</b><small>${on ? '✔ Puesto' : `+${item.beautyBonus ?? 0} ✨`}</small></button>`;
        })
        .join('')}</div>` : '<p class="hint">Aún no tienes accesorios.</p>'}`;
  };
  showModal({
    title: `🎒 Mochila de ${esc(pet.name)}`,
    body: render(),
    buttons: [{ label: 'Cerrar', act: 'close', primary: true }],
    onAction: (act, t, modal) => {
      const id = t.dataset.id;
      if (!id) return;
      if (act === 'use') {
        const r = eco.useItem(pet.id, id);
        showToast(r.message, r.ok ? 'good' : 'bad');
      } else if (act === 'equip') {
        if (Object.values(pet.data.equipped).includes(id)) eco.unequip(pet.id, id);
        else eco.equip(pet.id, id);
      }
      modal.body.innerHTML = render();
      return true;
    },
  });
}
