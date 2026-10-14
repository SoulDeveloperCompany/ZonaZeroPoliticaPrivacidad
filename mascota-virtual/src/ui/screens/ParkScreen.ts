/** Parque: socializar con las mascotas de otros jugadores conectados. */
import { DataRegistry } from '../../data/DataRegistry';
import { Feature } from '../../data/stages';
import { renderPetSVG } from '../../sprites/PetSprite';
import { GrowthSystem } from '../../systems/growth/GrowthSystem';
import { ParkService } from '../../systems/park/ParkService';
import { PetManager } from '../../systems/pet/PetManager';
import { petSVG, sexIcon, type Screen } from '../common';
import { esc, onAction } from '../dom';
import { GameState } from '../../core/GameState';
import { EconomySystem } from '../../systems/economy/EconomySystem';
import { Community } from '../../systems/online/Community';
import { OnlineService, onlineError } from '../../systems/online/OnlineService';

const GIFT_COST = 20;
import { showModal, showToast } from '../Overlay';

export class ParkScreen implements Screen {
  id = 'park';
  private root!: HTMLElement;
  private state: 'loading' | 'ok' | 'error' = 'loading';
  private error = '';

  mount(root: HTMLElement): void {
    this.root = root;
    onAction(root, (act, t) => {
      if (act === 'visitor') this.openVisitor(t.dataset.id!);
      if (act === 'refresh') void this.load();
      if (act === 'claim-challenge' && Community.instance.claim()) {
        showToast('🎁 ¡Premio del desafío recogido! Gracias por aportar.', 'good');
        this.render();
      }
    });
    this.render();
    void this.load();
  }

  private async load(): Promise<void> {
    this.state = 'loading';
    this.render();
    try {
      await ParkService.instance.load();
      this.state = 'ok';
    } catch (err) {
      this.state = 'error';
      this.error = OnlineService.describe(err);
    }
    this.render();
  }

  render(): void {
    const pet = PetManager.instance.selected;
    if (!pet || !ParkService.instance.canVisit(pet.id)) {
      const stage = GrowthSystem.instance.unlockStageFor(Feature.Park);
      this.root.innerHTML = `<h2 class="screen-title">🌳 Parque</h2>
        <div class="card center"><p>🔒 El parque se desbloquea cuando tu mascota es <b>${stage?.name ?? 'mayor'}</b>.</p></div>`;
      return;
    }
    const visitors = this.state === 'ok' ? ParkService.instance.visitors : [];
    const status =
      this.state === 'loading'
        ? '<div class="park-status">Buscando amigos en el parque…</div>'
        : this.state === 'error'
          ? `<div class="park-status">${esc(this.error)}</div>`
          : visitors.length
            ? ''
            : '<div class="park-status">Ahora mismo no hay nadie más en el parque. ¡Vuelve en un rato!</div>';
    this.root.innerHTML = `
      <h2 class="screen-title">🌳 Parque</h2>
      ${this.challengeHTML()}
      <div class="park">
        <span class="park-deco" style="left:4%;top:4%">🌳</span><span class="park-deco" style="right:6%;top:2%">🌲</span>
        <span class="park-deco" style="left:44%;top:46%">⛲</span><span class="park-deco" style="right:4%;bottom:6%">🌷</span>
        ${visitors
          .map(
            (v) => `<button class="park-pet" style="left:${v.x * 82}%;top:${v.y * 70}%" data-act="visitor" data-id="${v.id}">
              ${renderPetSVG({ speciesId: v.speciesId, genes: v.genes, stage: v.stage, equipped: v.equipped, sex: v.sex })}
              <span>${esc(v.name)}</span></button>`,
          )
          .join('')}
        <div class="park-pet park-me" style="left:40%;top:72%">${petSVG(pet)}<span>${esc(pet.name)}</span></div>
        ${status}
      </div>
      <p class="hint center">Aquí aparecen las mascotas de jugadores conectados en los últimos 30 minutos. Toca a una para saludarla. <button class="btn btn-sm" data-act="refresh">↻ Actualizar</button></p>`;
  }

  /** Golosina para la mascota de otro jugador: tú pagas 20, a su dueño le llegan 15 en su buzón. */
  private async sendGift(parkId: string, name: string): Promise<void> {
    const eco = EconomySystem.instance;
    if (!eco.pay({ coins: GIFT_COST })) {
      showToast('No tienes monedas suficientes', 'bad');
      return;
    }
    try {
      await OnlineService.instance.sendGift(parkId);
      showToast(`🎁 Le dejaste una golosina a ${name}. ¡Su dueño la recibirá pronto!`, 'good');
    } catch (err) {
      eco.addCoins(GIFT_COST);
      onlineError(err);
    }
  }

  /** Tarjeta del desafío semanal entre todos (Auditoría P12). */
  private challengeHTML(): string {
    const com = Community.instance;
    const c = com.current;
    if (!c) return '<div class="card challenge"><b>🤝 Desafío de la semana</b><p class="hint">Conéctate al servidor para ver el desafío entre todos los jugadores.</p></div>';
    const pct = Math.min(100, Math.round((c.progreso / c.objetivo) * 100));
    const premio = `${c.premio.monedas} 🪙${c.premio.estrellas ? ` + ${c.premio.estrellas} ⭐` : ''}`;
    const reclamado = GameState.instance.data.community.claimed.includes(c.semana);
    return `<div class="card challenge">
      <b>🤝 Desafío de la semana: ${esc(c.titulo)}</b>
      <div class="bond-row"><div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div><b>${c.progreso}/${c.objetivo}</b></div>
      <p class="hint">Tú has aportado ${com.myContribution}. Premio para quien aporte: ${premio}.</p>
      ${com.canClaim() ? '<button class="btn btn-primary" data-act="claim-challenge">🎁 Recoger premio</button>' : reclamado ? '<p class="hint">✔ Premio recogido. ¡Gracias por participar!</p>' : ''}
    </div>`;
  }

  private openVisitor(id: string): void {
    const pet = PetManager.instance.selected;
    const v = ParkService.instance.visitors.find((x) => x.id === id);
    if (!pet || !v) return;
    const species = DataRegistry.instance.getSpecies(v.speciesId);
    showModal({
      title: `${esc(v.name)} ${sexIcon(v.sex)}`,
      body: `<div class="visitor-card">${renderPetSVG({ speciesId: v.speciesId, genes: v.genes, stage: v.stage, equipped: v.equipped, mood: 'happy', sex: v.sex })}
        <p>${species.icon} ${species.name} · ${DataRegistry.instance.getStage(v.stage).name}<br/><small>Dueño/a: ${esc(v.ownerName)}</small></p></div>`,
      buttons: [
        { label: 'Volver', act: 'close' },
        { label: `🎁 Golosina (${GIFT_COST} 🪙)`, act: 'gift' },
        { label: '👋 Saludar', act: 'greet', primary: true },
      ],
      onAction: (act) => {
        if (act === 'gift') {
          void this.sendGift(v.id, v.name);
          return;
        }
        if (act !== 'greet') return;
        const r = ParkService.instance.greet(pet.id, v.id);
        showToast(r.ok ? `${r.message} (+${Math.round(r.happiness)} ❤️)` : r.message, r.ok ? 'good' : 'bad');
      },
    });
  }
}
