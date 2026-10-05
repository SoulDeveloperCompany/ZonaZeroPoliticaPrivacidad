/** Parque: socializar con otras mascotas (visitantes simulados hasta tener servidor). */
import { DataRegistry } from '../../data/DataRegistry';
import { Feature } from '../../data/stages';
import { renderPetSVG } from '../../sprites/PetSprite';
import { GrowthSystem } from '../../systems/growth/GrowthSystem';
import { ParkService } from '../../systems/park/ParkService';
import { PetManager } from '../../systems/pet/PetManager';
import { petSVG, sexIcon, type Screen } from '../common';
import { esc, onAction } from '../dom';
import { showModal, showToast } from '../Overlay';

export class ParkScreen implements Screen {
  id = 'park';
  private root!: HTMLElement;

  mount(root: HTMLElement): void {
    this.root = root;
    onAction(root, (act, t) => {
      if (act === 'visitor') this.openVisitor(t.dataset.id!);
    });
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
    const visitors = ParkService.instance.visitors();
    this.root.innerHTML = `
      <h2 class="screen-title">🌳 Parque</h2>
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
      </div>
      <p class="hint center">Toca a otra mascota para saludarla. 🌐 El multijugador online llegará con el servidor; por ahora los visitantes son simulados y cambian cada 30 minutos.</p>`;
  }

  private openVisitor(id: string): void {
    const pet = PetManager.instance.selected;
    const v = ParkService.instance.visitors().find((x) => x.id === id);
    if (!pet || !v) return;
    const species = DataRegistry.instance.getSpecies(v.speciesId);
    showModal({
      title: `${esc(v.name)} ${sexIcon(v.sex)}`,
      body: `<div class="visitor-card">${renderPetSVG({ speciesId: v.speciesId, genes: v.genes, stage: v.stage, equipped: v.equipped, mood: 'happy', sex: v.sex })}
        <p>${species.icon} ${species.name} · ${DataRegistry.instance.getStage(v.stage).name}<br/><small>Dueño/a: ${esc(v.ownerName)}</small></p></div>`,
      buttons: [
        { label: 'Volver', act: 'close' },
        { label: '👋 Saludar', act: 'greet', primary: true },
      ],
      onAction: (act) => {
        if (act !== 'greet') return;
        const r = ParkService.instance.greet(pet.id, v.id);
        showToast(r.ok ? `${r.message} (+${Math.round(r.happiness)} ❤️)` : r.message, r.ok ? 'good' : 'bad');
      },
    });
  }
}
