/**
 * Pantalla principal a pantalla completa: la mascota en su habitación.
 *
 * - Arriba: nombre (tocar para renombrar), etapa y barra de crecimiento.
 * - Centro: la mascota. Tocarla = acariciar; si duerme, la despierta (se enfada).
 * - Abajo: botones flotantes de cuidado sobre el suelo.
 * - Los stats están ocultos y se abren con el botón "Estado".
 */
import { Clock, formatDuration } from '../../core/Clock';
import { EventBus } from '../../core/EventBus';
import { GameState } from '../../core/GameState';
import { DataRegistry } from '../../data/DataRegistry';
import { renderRoomSVG } from '../../sprites/RoomScene';
import { EconomySystem } from '../../systems/economy/EconomySystem';
import { GrowthSystem } from '../../systems/growth/GrowthSystem';
import { InteractionSystem, describeFailure } from '../../systems/interaction/InteractionSystem';
import { PetManager } from '../../systems/pet/PetManager';
import type { Pet } from '../../systems/pet/Pet';
import { STAT_KEYS, STAT_LABELS, type PetStatKey } from '../../systems/pet/PetTypes';
import {
  STAT_HELP,
  STAT_ICONS,
  itemIcon,
  petSVG,
  sexIcon,
  spriteKey,
  stageName,
  statBarHTML,
  statLevel,
  updateStatBars,
  type Screen,
} from '../common';
import { el, esc, onAction } from '../dom';
import { openGames, openMissions } from '../GamesHub';
import { openBath } from '../minigames/BathScene';
import { MissionSystem } from '../../systems/games/MissionSystem';
import { chooseName } from '../NameChooser';
import { showModal, showToast } from '../Overlay';

/** Partículas que acompañan a cada animación. */
const PARTICLES: Record<string, string[]> = {
  eat: ['🍖', '😋', '✨'],
  bounce: ['⚽', '🎉', '💛'],
  wiggle: ['💖', '💕', '❤️'],
  bath: ['🫧', '🫧', '💧'],
  spin: ['⭐', '✨', '🎯'],
  walk: ['🌳', '🦋', '🌼'],
  wake: ['💢', '😾', '💤'],
  no: ['❌'],
};

/** Dónde se coloca cada mueble comprado en la habitación. */
const FURNITURE_POS: Record<string, string> = {
  furn_bed: 'left:3%;bottom:140px',
  furn_ball: 'right:4%;bottom:140px',
  furn_tv: 'left:4%;bottom:226px',
  furn_tub: 'left:22%;bottom:222px',
  furn_plant: 'right:22%;bottom:226px',
};

/** Burbuja de pensamiento con la necesidad más urgente. */
const NEED_ICON: Partial<Record<string, string>> = {
  hungry: '🍖',
  dirty: '🫧',
  sad: '🎾',
  sick: '🤒',
  tired: '🥱',
};

export class HomeScreen implements Screen {
  id = 'home';
  private root!: HTMLElement;
  private lastSprite = '';
  private lastNight: boolean | null = null;
  private statsOpen = false;
  private offs: (() => void)[] = [];
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

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
      bus.on('pet:sleepChanged', () => this.tick()),
    ];
    this.render();
    this.scheduleIdle();
  }

  unmount(): void {
    this.offs.forEach((off) => off());
    if (this.idleTimer) clearTimeout(this.idleTimer);
  }

  // ---------- Vida en reposo ----------

  /** Cada pocos segundos la mascota hace algo por su cuenta para no verse estática. */
  private scheduleIdle(): void {
    this.idleTimer = setTimeout(() => {
      this.idleBehavior();
      this.scheduleIdle();
    }, 3500 + Math.random() * 3500);
  }

  private idleBehavior(): void {
    const pet = this.pet;
    const sprite = this.root.querySelector<HTMLElement>('.pet-sprite');
    const wrap = this.root.querySelector<HTMLElement>('.pet-stage-wrap');
    const trayOpen = this.root.querySelector<HTMLElement>('.food-tray')?.hidden === false;
    if (!pet || !pet.isActive || !sprite || !wrap || trayOpen) return;
    if ([...sprite.classList].some((c) => c.startsWith('anim-'))) return;
    if (pet.data.sleeping) {
      // Dormida: vuelve al centro y solo respira
      wrap.style.setProperty('--walk-x', '0px');
      return;
    }
    const roll = Math.random();
    if (roll < 0.4) {
      // Pasea por la alfombra mirando hacia donde va
      const max = wrap.clientWidth * 0.32;
      const current = parseFloat(wrap.style.getPropertyValue('--walk-x')) || 0;
      let target = (Math.random() * 2 - 1) * max;
      if (Math.abs(target - current) < max * 0.4) target = -current || max * 0.6;
      sprite.classList.toggle('face-left', target < current);
      sprite.classList.add('walking');
      wrap.style.setProperty('--walk-x', `${Math.round(target)}px`);
      setTimeout(() => sprite.classList.remove('walking'), 1700);
    } else {
      const cls = pet.isDrowsy ? 'idle-yawn' : (['idle-hop', 'idle-tilt', 'idle-look', 'idle-wiggle'] as const)[Math.floor(Math.random() * 4)];
      sprite.classList.add(cls);
      setTimeout(() => sprite.classList.remove(cls), 1600);
    }
  }

  private get pet(): Pet | undefined {
    return PetManager.instance.selected;
  }

  // ---------- Render ----------

  render(): void {
    const pet = this.pet;
    const home = PetManager.instance.homePets();
    const tabs =
      home.length > 1
        ? `<div class="pet-switch">${home
            .map((p) => `<button class="pet-switch-btn ${p.id === pet?.id ? 'active' : ''}" data-act="select" data-id="${p.id}" aria-label="${esc(p.name)}">${petSVG(p)}</button>`)
            .join('')}</div>`
        : '';

    this.lastSprite = '';
    this.lastNight = null;

    if (!pet) {
      this.root.innerHTML = `<div class="home"><div class="room-bg">${renderRoomSVG(false)}</div>
        <div class="home-empty card">No hay mascotas en casa. Trae una del rancho en <b>Familia</b>.</div></div>`;
      return;
    }

    const actions = DataRegistry.instance
      .allActions()
      .filter((a) => a.button !== false)
      .map(
        (a) => `<button class="dock-btn" data-act="action" data-id="${a.id}">
          <span class="dock-icon">${a.icon}</span><span class="dock-name">${a.name}</span><span class="dock-badge"></span></button>`,
      )
      .join('');

    this.root.innerHTML = `
      <div class="home">
        <div class="room-bg"></div>
        ${this.furnitureHTML()}
        <div class="home-top">
          ${tabs}
          <button class="name-chip" data-act="rename">${esc(pet.name)} ${sexIcon(pet.data.sex)} <span class="tag">${stageName(pet)}</span> <span class="edit">✏️</span></button>
          <div class="growth-mini"><div class="growth-label"></div><div class="bar bar-growth"><div class="bar-fill"></div></div></div>
        </div>
        <button class="stats-btn" data-act="stats" aria-label="Ver estado">📊<span class="stats-alert" hidden></span></button>
        <button class="stats-btn missions-btn" data-act="missions" aria-label="Misiones">📋<span class="missions-badge" hidden></span></button>
        <div class="need-bubble" hidden></div>
        <div class="pet-stage-wrap"><div class="pet-sprite" data-act="pet-touch"></div></div>
        <div class="fx-layer"></div>
        ${pet.isEscaped ? this.escapedHTML(pet) : `<div class="dock">${actions}
          <button class="dock-btn" data-act="backpack"><span class="dock-icon">🎒</span><span class="dock-name">Mochila</span></button></div>
          <div class="food-tray" hidden>
            <div class="tray-head"><span>Arrastra la comida hasta ${esc(pet.name)} 👆</span><button class="icon-close" data-act="close-tray" aria-label="Cerrar">✕</button></div>
            <div class="tray-items"></div>
          </div>`}
        <div class="stats-sheet ${this.statsOpen ? 'open' : ''}">
          <div class="sheet-head"><b>Estado de ${esc(pet.name)}</b><button class="icon-close" data-act="stats" aria-label="Cerrar">✕</button></div>
          <div class="stats">${STAT_KEYS.map((k) => statBarHTML(k, pet.stats[k])).join('')}</div>
          <p class="stat-help-box" hidden></p>
          <p class="hint sheet-hint"></p>
        </div>
      </div>`;
    this.tick();
  }

  private furnitureHTML(): string {
    return GameState.instance.data.furniture
      .map((id) => `<span class="furniture" style="${FURNITURE_POS[id] ?? 'left:50%;bottom:160px'}">${DataRegistry.instance.getItem(id).icon}</span>`)
      .join('');
  }

  private escapedHTML(pet: Pet): string {
    return `
      <div class="escaped-card card">
        <h3>💨 ¡${esc(pet.name)} se ha escapado!</h3>
        <p>Le faltaron cuidados y se fue de casa. Si no das con su rastro a tiempo, se quedará con otra familia.</p>
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

    // Fondo de día o de noche según si duerme
    const night = pet.data.sleeping;
    if (night !== this.lastNight) {
      const bg = this.root.querySelector<HTMLElement>('.room-bg');
      if (bg) bg.innerHTML = renderRoomSVG(night);
      this.root.querySelector('.home')?.classList.toggle('night', night);
      this.lastNight = night;
    }

    const sprite = this.root.querySelector<HTMLElement>('.pet-sprite');
    if (sprite) {
      if (pet.isEscaped) {
        sprite.innerHTML = '';
      } else {
        const key = spriteKey(pet) + (pet.isDrowsy ? '|drowsy' : '');
        if (key !== this.lastSprite) {
          sprite.innerHTML = petSVG(pet);
          sprite.classList.toggle('drowsy', pet.isDrowsy);
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

    // Stats (ocultos en la hoja inferior) y aviso si alguno está mal
    const values: Partial<Record<PetStatKey, number>> = { ...pet.stats, beauty: pet.effectiveBeauty };
    updateStatBars(this.root, values);
    const bad = (['hunger', 'happiness', 'energy', 'health', 'hygiene'] as PetStatKey[]).some(
      (k) => statLevel(k, pet.stats[k]) === 'bad',
    );
    const alert = this.root.querySelector<HTMLElement>('.stats-alert');
    if (alert) alert.hidden = !bad;
    const sheetHint = this.root.querySelector('.sheet-hint');
    if (sheetHint) {
      sheetHint.textContent = pet.data.sleeping
        ? '💤 Está durmiendo. Se despertará sola al recuperar energía.'
        : pet.isDrowsy
          ? '🥱 Tiene sueño: pronto se irá a dormir.'
          : '';
    }

    // Misiones listas para cobrar
    const badge = this.root.querySelector<HTMLElement>('.missions-badge');
    if (badge) {
      const n = MissionSystem.instance.claimableCount();
      badge.hidden = n === 0;
      badge.textContent = String(n);
    }

    // Burbuja de necesidad
    const bubble = this.root.querySelector<HTMLElement>('.need-bubble');
    if (bubble) {
      const need = NEED_ICON[pet.mood];
      bubble.hidden = !need;
      if (need && bubble.textContent !== need) bubble.textContent = need;
    }

    // Barra de crecimiento (arriba)
    const g = GrowthSystem.instance.progress(pet);
    const label = this.root.querySelector('.growth-label');
    const fill = this.root.querySelector<HTMLElement>('.bar-growth .bar-fill');
    if (label && fill) {
      const boost = GrowthSystem.instance.growthMultiplier(pet, Clock.now()) > 1 ? ' ⏩x2' : '';
      label.innerHTML = `<b>${g.current.name}</b>${boost}`;
      fill.style.width = `${Math.round(g.progress * 100)}%`;
    }

    // Botones flotantes: bloqueado / cooldown
    const now = Clock.now();
    this.root.querySelectorAll<HTMLElement>('.dock-btn[data-act="action"]').forEach((btn) => {
      const id = btn.dataset.id!;
      const blocked = id === 'play' && !pet.data.sleeping ? null : InteractionSystem.instance.check(pet, id, now);
      const badge = btn.querySelector('.dock-badge')!;
      const locked = blocked?.ok === false && blocked.reason === 'locked';
      btn.classList.toggle('blocked', !!blocked);
      btn.classList.toggle('locked', locked);
      badge.textContent =
        blocked?.ok === false && blocked.reason === 'cooldown'
          ? `${Math.ceil((blocked.remainingMs ?? 0) / 1000)}s`
          : locked
            ? '🔒'
            : blocked?.ok === false && blocked.reason === 'sleeping'
              ? '💤'
              : '';
    });
  }

  // ---------- Acciones ----------

  private handle(act: string, t: HTMLElement): void {
    const pet = this.pet;
    switch (act) {
      case 'select':
        PetManager.instance.select(t.dataset.id!);
        return;
      case 'stats':
        this.statsOpen = !this.statsOpen;
        this.root.querySelector('.stats-sheet')?.classList.toggle('open', this.statsOpen);
        return;
      case 'rename':
        if (pet) void this.rename(pet);
        return;
      case 'stat-help': {
        const key = t.dataset.stat as PetStatKey;
        const box = this.root.querySelector<HTMLElement>('.stat-help-box');
        if (!box) return;
        const same = !box.hidden && box.dataset.key === key;
        box.hidden = same;
        box.dataset.key = key;
        box.innerHTML = `<b>${STAT_ICONS[key]} ${STAT_LABELS[key]}:</b> ${STAT_HELP[key]}`;
        return;
      }
      case 'missions':
        openMissions(() => this.tick());
        return;
      case 'close-tray':
        this.toggleTray(false);
        return;
      case 'pet-touch':
        if (!pet?.isActive) return;
        // Tocarla mientras duerme la despierta (y se enfada); si no, la acaricia
        if (pet.data.sleeping) InteractionSystem.instance.wakeUp(pet.id);
        else InteractionSystem.instance.perform(pet.id, 'pet');
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

  private async rename(pet: Pet): Promise<void> {
    const name = await chooseName('Nombre de tu mascota', pet.data.speciesId, pet.name);
    if (name && PetManager.instance.rename(pet.id, name)) {
      showToast(`Ahora se llama ${name} ✨`, 'good');
      this.render();
    }
  }

  private doAction(pet: Pet, actionId: string): void {
    // "Jugar" abre los minijuegos: allí se valida energía y etapa de cada juego
    const blocked = actionId === 'play' ? (pet.data.sleeping ? InteractionSystem.instance.check(pet, actionId) : null) : InteractionSystem.instance.check(pet, actionId);
    if (blocked && !blocked.ok) {
      showToast(describeFailure(blocked), 'bad');
      return;
    }
    if (actionId === 'feed') {
      this.toggleTray(true);
      return;
    }
    if (actionId === 'play') {
      openGames(pet);
      return;
    }
    if (actionId === 'bathe') {
      void openBath(pet);
      return;
    }
    const r = InteractionSystem.instance.perform(pet.id, actionId);
    if (!r.ok) showToast(describeFailure(r), 'bad');
  }

  // ---------- Dar de comer arrastrando ----------

  /** Muestra la bandeja de comida (en lugar de los botones) o la oculta. */
  private toggleTray(open: boolean): void {
    const tray = this.root.querySelector<HTMLElement>('.food-tray');
    const dock = this.root.querySelector<HTMLElement>('.dock');
    const pet = this.pet;
    if (!tray || !dock || !pet) return;
    tray.hidden = !open;
    dock.hidden = open;
    if (!open) return;
    const fav = pet.species.favoriteFoods;
    const items = tray.querySelector<HTMLElement>('.tray-items')!;
    items.innerHTML = EconomySystem.instance
      .inventoryBy('food')
      .map(
        ({ item, quantity }) => `<div class="food-item" data-food="${item.id}" title="${esc(item.name)}">
          <span class="food-emoji">${item.icon}</span>
          <span class="food-qty">${quantity === Infinity ? '∞' : `x${quantity}`}</span>
          ${fav.includes(item.id) ? '<span class="food-fav">😍</span>' : ''}
          <small>${esc(item.name)}</small></div>`,
      )
      .join('');
    items.querySelectorAll<HTMLElement>('.food-item').forEach((node) => this.makeDraggable(node));
  }

  /** Arrastrar un alimento: si se suelta sobre la mascota, se lo come. */
  private makeDraggable(node: HTMLElement): void {
    node.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const home = this.root.querySelector<HTMLElement>('.home')!;
      const homeRect = home.getBoundingClientRect();
      const ghost = el('span', 'food-ghost', node.querySelector('.food-emoji')!.textContent ?? '');
      home.appendChild(ghost);
      const move = (ev: PointerEvent) => {
        ghost.style.transform = `translate(${ev.clientX - homeRect.left - 30}px, ${ev.clientY - homeRect.top - 60}px)`;
        this.root.querySelector('.pet-sprite')?.classList.toggle('feed-target', this.overPet(ev.clientX, ev.clientY - 30));
      };
      move(e);
      node.setPointerCapture(e.pointerId);
      node.addEventListener('pointermove', move);
      const up = (ev: PointerEvent) => {
        node.removeEventListener('pointermove', move);
        node.removeEventListener('pointerup', up);
        node.removeEventListener('pointercancel', up);
        this.root.querySelector('.pet-sprite')?.classList.remove('feed-target');
        if (this.overPet(ev.clientX, ev.clientY - 30)) this.feedWith(node.dataset.food!, ghost);
        else {
          ghost.classList.add('ghost-back');
          setTimeout(() => ghost.remove(), 250);
          if (Math.abs(ev.clientY - e.clientY) < 10) showToast('Arrastra la comida hasta tu mascota 👆');
        }
      };
      node.addEventListener('pointerup', up);
      node.addEventListener('pointercancel', up);
    });
  }

  private overPet(x: number, y: number): boolean {
    const r = this.root.querySelector('.pet-sprite')?.getBoundingClientRect();
    if (!r) return false;
    return x > r.left + r.width * 0.15 && x < r.right - r.width * 0.15 && y > r.top + r.height * 0.2 && y < r.bottom;
  }

  /** La mascota recibe la comida: se la come o niega con la cabeza. */
  private feedWith(itemId: string, ghost: HTMLElement): void {
    const pet = this.pet;
    if (!pet) return ghost.remove();
    const r = InteractionSystem.instance.perform(pet.id, 'feed', { itemId });
    if (!r.ok) {
      ghost.classList.add('ghost-back');
      setTimeout(() => ghost.remove(), 250);
      if (r.reason === 'notHungry') {
        this.feedback('no', {}, '🙅 ¡No quiero, ya comí!');
      } else showToast(describeFailure(r), 'bad');
      return;
    }
    // La comida "entra" en la boca
    const sprite = this.root.querySelector<HTMLElement>('.pet-sprite')!.getBoundingClientRect();
    const home = this.root.querySelector<HTMLElement>('.home')!.getBoundingClientRect();
    ghost.style.transition = 'transform 0.35s ease-in, opacity 0.35s';
    ghost.style.transform = `translate(${sprite.left - home.left + sprite.width / 2 - 30}px, ${sprite.top - home.top + sprite.height * 0.45}px) scale(0.25)`;
    ghost.style.opacity = '0';
    setTimeout(() => ghost.remove(), 400);
    this.toggleTray(false);
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
      node.style.top = `${30 + i * 7}%`;
      node.style.animationDelay = `${i * 120}ms`;
      fx.appendChild(node);
      setTimeout(() => node.remove(), 2000);
    });
  }
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
