/** Familia: casa (máx. 3), rancho, apareamiento y adopción pública. */
import { Clock, formatDuration } from '../../core/Clock';
import { GameConfig } from '../../core/GameConfig';
import { DataRegistry } from '../../data/DataRegistry';
import { renderPetSVG } from '../../sprites/PetSprite';
import { BreedingSystem, type Partner } from '../../systems/breeding/BreedingSystem';
import { PetManager } from '../../systems/pet/PetManager';
import type { Pet } from '../../systems/pet/Pet';
import { GrowthStage, PetLocation } from '../../systems/pet/PetTypes';
import { petSVG, sexIcon, stageName, type Screen } from '../common';
import { esc, onAction, priceHTML, setHTML } from '../dom';
import { chooseName } from '../NameChooser';
import { confirmModal, showModal, showToast } from '../Overlay';

export class FamilyScreen implements Screen {
  id = 'family';
  private root!: HTMLElement;

  mount(root: HTMLElement): void {
    this.root = root;
    onAction(root, (act, t) => void this.handle(act, t.dataset.id ?? ''));
    this.render();
  }

  tick(): void {
    this.render();
  }

  private petRow(p: Pet, buttons: string): string {
    return `<div class="pet-row">
      <span class="pet-row-sprite">${petSVG(p)}</span>
      <div class="pet-row-info"><b>${esc(p.name)}</b> ${sexIcon(p.data.sex)}<small>${p.species.icon} ${p.species.name} · ${stageName(p)} · Gen ${p.data.generation}</small></div>
      <div class="pet-row-btns">${buttons}</div></div>`;
  }

  render(): void {
    const pm = PetManager.instance;
    const home = pm.homePets();
    const ranch = pm.byLocation(PetLocation.Ranch);
    const listed = pm.byLocation(PetLocation.Adoption);
    const selected = pm.selected;
    const offers = BreedingSystem.instance.adoption.getOffers();

    let breedHTML = '<p class="hint">Selecciona una mascota en casa.</p>';
    if (selected && selected.isActive) {
      const check = BreedingSystem.instance.canBreed(selected);
      breedHTML = check.ok
        ? `<p>${esc(selected.name)} está list${selected.data.sex === 'female' ? 'a' : 'o'} para buscar pareja.</p><button class="btn btn-primary" data-act="partners" data-id="${selected.id}">💞 Buscar pareja</button>`
        : `<p class="hint">${esc(selected.name)}: ${BreedingSystem.instance.describe(check)}.</p>`;
    }

    setHTML(this.root, `
      <h2 class="screen-title">👪 Familia</h2>
      <div class="card">
        <h3>🏠 En casa (${home.length}/${GameConfig.MAX_ACTIVE_PETS})</h3>
        ${home.map((p) => this.petRow(p, p.isEscaped ? '<small>💨 Escapado</small>' : `<button class="btn btn-sm" data-act="toRanch" data-id="${p.id}">🐎 Al rancho</button><button class="btn btn-sm" data-act="list" data-id="${p.id}">🤝 Adopción</button>`)).join('')}
      </div>
      <div class="card">
        <h3>💞 Crianza</h3>
        <p class="hint">Solo adultos, misma especie y sexo opuesto. La cría hereda color, patrón, tamaño y stats de sus padres.</p>
        ${breedHTML}
      </div>
      <div class="card">
        <h3>🐎 Rancho (${ranch.length})</h3>
        <p class="hint">En el rancho las mascotas están bien atendidas: no pierden stats ni envejecen.</p>
        ${ranch.map((p) => this.petRow(p, `<button class="btn btn-sm" data-act="toHome" data-id="${p.id}" ${pm.hasFreeSlot() ? '' : 'disabled'}>🏠 A casa</button><button class="btn btn-sm" data-act="list" data-id="${p.id}">🤝 Adopción</button>`)).join('') || '<p class="hint">Vacío.</p>'}
      </div>
      <div class="card">
        <h3>🤝 Tus mascotas en adopción</h3>
        ${listed.map((p) => this.petRow(p, `<small>⏳ ${formatDuration(Math.max(0, (p.data.listedAt ?? 0) + GameConfig.ADOPTION_WAIT_MS - Clock.now()))}</small><button class="btn btn-sm" data-act="unlist" data-id="${p.id}">Retirar</button>`)).join('') || '<p class="hint">Ninguna. Una familia adoptará tus crías publicadas y te dará monedas.</p>'}
      </div>
      <div class="card">
        <h3>🏡 Centro de adopción</h3>
        <p class="hint">Crías que otros jugadores ponen en adopción.</p>
        ${offers.length ? '' : '<p class="empty-note">Ahora mismo nadie ha puesto crías en adopción. Cuando alguien publique una, aparecerá aquí.</p>'}
        ${offers
          .map((o) => {
            const sp = DataRegistry.instance.getSpecies(o.speciesId);
            return `<div class="pet-row"><span class="pet-row-sprite">${renderPetSVG({ speciesId: o.speciesId, genes: o.genes, stage: GrowthStage.Baby, sex: o.sex, mood: 'happy' })}</span>
              <div class="pet-row-info"><b>${esc(o.name)}</b> ${sexIcon(o.sex)}<small>${sp.icon} ${sp.name} · de ${esc(o.ownerName)}</small></div>
              <div class="pet-row-btns"><button class="btn btn-sm btn-primary" data-act="adopt" data-id="${o.id}">${priceHTML(o.price)}</button></div></div>`;
          })
          .join('')}
      </div>`);
  }

  private async handle(act: string, id: string): Promise<void> {
    const pm = PetManager.instance;
    const bs = BreedingSystem.instance;
    switch (act) {
      case 'toRanch':
        pm.moveToRanch(id);
        break;
      case 'toHome':
        if (!pm.moveToHome(id)) showToast('Ya tienes 3 mascotas en casa', 'bad');
        break;
      case 'list': {
        const pet = pm.get(id);
        if (!pet) return;
        const ok = await confirmModal('Dar en adopción', `¿Publicar a <b>${esc(pet.name)}</b> en adopción? En unos minutos una familia le dará un hogar y te regalará unas 🪙 ${bs.adoptionReward(pet)}.`, 'Publicar');
        if (ok && !bs.listForAdoption(id)) showToast('No puedes dar en adopción a tu única mascota', 'bad');
        break;
      }
      case 'unlist':
        bs.cancelListing(id);
        break;
      case 'adopt': {
        const offer = bs.adoption.getOffers().find((o) => o.id === id);
        if (!offer) return;
        const name = await chooseName('¿Cómo se llamará?', offer.speciesId, offer.name);
        if (name === null) return;
        const r = bs.adopt(id, name);
        if (r.ok) showToast(`¡${r.baby.name} llegó ${r.location === PetLocation.Ranch ? 'al rancho' : 'a casa'}!`, 'good');
        else showToast(r.reason, 'bad');
        break;
      }
      case 'partners':
        this.openPartners(id);
        break;
    }
    this.render();
  }

  private openPartners(petId: string): void {
    const pet = PetManager.instance.get(petId);
    if (!pet) return;
    const partners = BreedingSystem.instance.findPartners(pet);
    const rows = partners
      .map((p, i) => {
        if (p.kind === 'own') {
          return this.petRow(p.pet, `<button class="btn btn-sm btn-primary" data-act="breed" data-i="${i}">💞 Gratis</button>`);
        }
        const n = p.npc;
        return `<div class="pet-row"><span class="pet-row-sprite">${renderPetSVG({ speciesId: n.speciesId, genes: n.genes, stage: GrowthStage.Adult, sex: n.sex })}</span>
          <div class="pet-row-info"><b>${esc(n.name)}</b> ${sexIcon(n.sex)}<small>de ${esc(n.ownerName)} · 🏃 ${n.genes.baseAgility} ✨ ${n.genes.baseBeauty}</small></div>
          <div class="pet-row-btns"><button class="btn btn-sm btn-primary" data-act="breed" data-i="${i}">🪙 ${n.fee}</button></div></div>`;
      })
      .join('');
    showModal({
      title: `💞 Parejas para ${esc(pet.name)}`,
      body: rows || '<p>No hay parejas disponibles ahora.</p>',
      buttons: [{ label: 'Cerrar', act: 'close' }],
      onAction: (act, t, modal) => {
        if (act !== 'breed') return;
        const partner: Partner = partners[Number(t.dataset.i)];
        modal.close();
        void this.breed(pet, partner);
      },
    });
  }

  private async breed(pet: Pet, partner: Partner): Promise<void> {
    const name = await chooseName('¡Va a nacer una cría! ¿Cómo se llamará?', pet.data.speciesId);
    if (name === null) return;
    const r = BreedingSystem.instance.breed(pet.id, partner, name);
    if (!r.ok) {
      showToast(r.reason, 'bad');
      return;
    }
    showModal({
      title: '🐣 ¡Ha nacido!',
      body: `<div class="visitor-card">${petSVG(r.baby)}<p><b>${esc(r.baby.name)}</b> ${sexIcon(r.baby.data.sex)}<br/>
        <small>Generación ${r.baby.data.generation} · 🏃 ${r.baby.data.genes.baseAgility} ✨ ${r.baby.data.genes.baseBeauty}</small><br/>
        ${r.location === PetLocation.Ranch ? 'Como ya tienes 3 en casa, está en el rancho.' : '¡Ya está en casa!'}</p></div>`,
    });
    this.render();
  }
}
