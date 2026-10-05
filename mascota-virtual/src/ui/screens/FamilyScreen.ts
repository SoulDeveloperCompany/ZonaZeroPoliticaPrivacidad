/** Familia: casa (máx. 3), rancho, apareamiento y adopción entre jugadores. */
import { GameConfig } from '../../core/GameConfig';
import { DataRegistry } from '../../data/DataRegistry';
import { Feature } from '../../data/stages';
import { renderPetSVG } from '../../sprites/PetSprite';
import { BreedingSystem, PARTNER_FEE, type Partner } from '../../systems/breeding/BreedingSystem';
import { GrowthSystem } from '../../systems/growth/GrowthSystem';
import { OnlineService, type RemoteAdoption } from '../../systems/online/OnlineService';
import { PetManager } from '../../systems/pet/PetManager';
import type { Pet } from '../../systems/pet/Pet';
import { GrowthStage, PetLocation } from '../../systems/pet/PetTypes';
import { petSVG, sexIcon, stageName, type Screen } from '../common';
import { esc, onAction, setHTML } from '../dom';
import { chooseName } from '../NameChooser';
import { confirmModal, showModal, showToast } from '../Overlay';

export class FamilyScreen implements Screen {
  id = 'family';
  private root!: HTMLElement;
  /** Crías de otros jugadores (se cargan del servidor). */
  private offers: RemoteAdoption[] = [];
  private offersState: 'idle' | 'loading' | 'ok' | 'error' = 'idle';
  private offersError = '';
  private busy = false;

  mount(root: HTMLElement): void {
    this.root = root;
    onAction(root, (act, t) => void this.handle(act, t.dataset.id ?? ''));
    this.render();
    void this.loadOffers();
  }

  tick(): void {
    this.render();
  }

  private async loadOffers(): Promise<void> {
    if (!OnlineService.instance.isConfigured()) {
      this.offersState = 'error';
      this.offersError = OnlineService.describe(new Error('sin-servidor'));
      this.render();
      return;
    }
    this.offersState = 'loading';
    this.render();
    try {
      this.offers = await OnlineService.instance.listAdoptions();
      this.offersState = 'ok';
    } catch (err) {
      this.offersState = 'error';
      this.offersError = OnlineService.describe(err);
    }
    this.render();
  }

  private petRow(p: Pet, buttons: string): string {
    return `<div class="pet-row">
      <span class="pet-row-sprite">${petSVG(p)}</span>
      <div class="pet-row-info"><b>${esc(p.name)}</b> ${sexIcon(p.data.sex)}<small>${p.species.icon} ${p.species.name} · ${stageName(p)} · Gen ${p.data.generation}${p.data.partnerListingId ? ' · 💞 ofrecida como pareja' : ''}</small></div>
      <div class="pet-row-btns">${buttons}</div></div>`;
  }

  private offersHTML(): string {
    if (this.offersState === 'loading') return '<p class="empty-note">Cargando…</p>';
    if (this.offersState === 'error') return `<p class="empty-note">${esc(this.offersError)}</p>`;
    if (!this.offers.length) return '<p class="empty-note">Ahora mismo nadie ha puesto crías en adopción. Cuando alguien publique una, aparecerá aquí.</p>';
    return this.offers
      .map((o) => {
        const sp = DataRegistry.instance.getSpecies(o.especie);
        const genes = { primaryColor: sp.primaryPalette[0], secondaryColor: sp.secondaryPalette[0], pattern: 'plain' as const, size: 1, ...o.genes };
        return `<div class="pet-row"><span class="pet-row-sprite">${renderPetSVG({ speciesId: o.especie, genes, stage: GrowthStage.Baby, sex: o.sexo, mood: 'happy' })}</span>
          <div class="pet-row-info"><b>${esc(o.nombre)}</b> ${sexIcon(o.sexo)}<small>${sp.icon} ${sp.name} · de ${esc(o.duenoApodo)}</small></div>
          <div class="pet-row-btns"><button class="btn btn-sm btn-primary" data-act="adopt" data-id="${esc(o.oferta)}">🪙 ${o.precio}</button></div></div>`;
      })
      .join('');
  }

  render(): void {
    const pm = PetManager.instance;
    const home = pm.homePets();
    const ranch = pm.byLocation(PetLocation.Ranch);
    const listed = pm.byLocation(PetLocation.Adoption);
    const selected = pm.selected;

    let breedHTML = '<p class="hint">Selecciona una mascota en casa.</p>';
    if (selected && selected.isActive) {
      const check = BreedingSystem.instance.canBreed(selected);
      const adult = GrowthSystem.instance.isUnlocked(selected, Feature.Breed);
      breedHTML = check.ok
        ? `<p>${esc(selected.name)} puede tener crías.</p><button class="btn btn-primary" data-act="partners" data-id="${selected.id}">💞 Buscar pareja</button>`
        : `<p class="hint">${esc(selected.name)}: ${BreedingSystem.instance.describe(check)}.</p>`;
      if (adult) {
        breedHTML += selected.data.partnerListingId
          ? `<button class="btn" data-act="unoffer" data-id="${selected.id}">Dejar de ofrecer como pareja</button>`
          : `<button class="btn" data-act="offer" data-id="${selected.id}">🌐 Ofrecer como pareja (cobras 🪙 ${PARTNER_FEE})</button>`;
      }
    }

    setHTML(this.root, `
      <h2 class="screen-title">👪 Familia</h2>
      <div class="card">
        <h3>🏠 En casa (${home.length}/${GameConfig.MAX_ACTIVE_PETS})</h3>
        ${home.map((p) => this.petRow(p, p.isEscaped ? '<small>💨 Escapado</small>' : `<button class="btn btn-sm" data-act="toRanch" data-id="${p.id}">🐎 Al rancho</button><button class="btn btn-sm" data-act="list" data-id="${p.id}">🤝 Adopción</button>`)).join('')}
      </div>
      <div class="card family-breed">
        <h3>💞 Crianza</h3>
        <p class="hint">Solo adultos, misma especie y sexo opuesto. La pareja puede ser tuya o de otro jugador. La cría hereda color, patrón, tamaño y stats.</p>
        ${breedHTML}
      </div>
      <div class="card">
        <h3>🐎 Rancho (${ranch.length})</h3>
        <p class="hint">En el rancho las mascotas están bien atendidas: no pierden stats ni envejecen.</p>
        ${ranch.map((p) => this.petRow(p, `<button class="btn btn-sm" data-act="toHome" data-id="${p.id}" ${pm.hasFreeSlot() ? '' : 'disabled'}>🏠 A casa</button><button class="btn btn-sm" data-act="list" data-id="${p.id}">🤝 Adopción</button>`)).join('') || '<p class="hint">Vacío.</p>'}
      </div>
      <div class="card">
        <h3>🤝 Tus mascotas en adopción</h3>
        ${listed.map((p) => this.petRow(p, `<small>Esperando familia…</small><button class="btn btn-sm" data-act="unlist" data-id="${p.id}">Retirar</button>`)).join('') || '<p class="hint">Ninguna. Cuando otro jugador adopte una de tus crías publicadas, recibirás monedas.</p>'}
      </div>
      <div class="card">
        <h3>🏡 Centro de adopción <button class="btn btn-sm refresh" data-act="refresh">↻</button></h3>
        <p class="hint">Crías que otros jugadores ponen en adopción.</p>
        ${this.offersHTML()}
      </div>`);
  }

  private async handle(act: string, id: string): Promise<void> {
    if (this.busy) return;
    const pm = PetManager.instance;
    const bs = BreedingSystem.instance;
    const run = async (fn: () => Promise<{ ok: true } | { ok: false; reason: string }>, okMsg: string) => {
      this.busy = true;
      showToast('Conectando…');
      try {
        const r = await fn();
        showToast(r.ok ? okMsg : r.reason, r.ok ? 'good' : 'bad');
      } finally {
        this.busy = false;
      }
    };
    switch (act) {
      case 'toRanch':
        pm.moveToRanch(id);
        break;
      case 'toHome':
        if (!pm.moveToHome(id)) showToast('Ya tienes 3 mascotas en casa', 'bad');
        break;
      case 'refresh':
        void this.loadOffers();
        return;
      case 'list': {
        const pet = pm.get(id);
        if (!pet) return;
        const ok = await confirmModal('Dar en adopción', `¿Publicar a <b>${esc(pet.name)}</b> para que otro jugador la adopte? Cuando alguien lo haga recibirás 🪙 ${bs.adoptionReward(pet)}.`, 'Publicar');
        if (ok) await run(() => bs.listForAdoption(id), '🤝 Publicada en adopción');
        break;
      }
      case 'unlist':
        await run(() => bs.cancelListing(id), 'Publicación retirada');
        break;
      case 'offer':
        await run(() => bs.offerAsPartner(id), '💞 Ahora otros jugadores pueden elegirla como pareja');
        break;
      case 'unoffer':
        await run(() => bs.withdrawPartner(id), 'Ya no se ofrece como pareja');
        break;
      case 'adopt': {
        const offer = this.offers.find((o) => o.oferta === id);
        if (!offer) return;
        const name = await chooseName('¿Cómo se llamará?', offer.especie, offer.nombre);
        if (name === null) return;
        this.busy = true;
        const r = await bs.adopt(offer, name);
        this.busy = false;
        if (r.ok) {
          showToast(`¡${r.baby.name} llegó ${r.location === PetLocation.Ranch ? 'al rancho' : 'a casa'}!`, 'good');
          this.offers = this.offers.filter((o) => o.oferta !== id);
        } else showToast(r.reason, 'bad');
        break;
      }
      case 'partners':
        await this.openPartners(id);
        break;
    }
    this.render();
  }

  private async openPartners(petId: string): Promise<void> {
    const pet = PetManager.instance.get(petId);
    if (!pet) return;
    this.busy = true;
    const { partners, error } = await BreedingSystem.instance.findPartners(pet);
    this.busy = false;
    const rows = partners
      .map((p, i) => {
        if (p.kind === 'own') return this.petRow(p.pet, `<button class="btn btn-sm btn-primary" data-act="breed" data-i="${i}">💞 Gratis</button>`);
        const l = p.listing;
        const sp = DataRegistry.instance.getSpecies(l.especie);
        const genes = { primaryColor: sp.primaryPalette[0], secondaryColor: sp.secondaryPalette[0], pattern: 'plain' as const, size: 1, ...l.genes };
        return `<div class="pet-row"><span class="pet-row-sprite">${renderPetSVG({ speciesId: l.especie, genes, stage: GrowthStage.Adult, sex: l.sexo })}</span>
          <div class="pet-row-info"><b>${esc(l.nombre)}</b> ${sexIcon(l.sexo)}<small>de ${esc(l.duenoApodo)} · 🏃 ${l.genes.baseAgility ?? '?'} ✨ ${l.genes.baseBeauty ?? '?'}</small></div>
          <div class="pet-row-btns"><button class="btn btn-sm btn-primary" data-act="breed" data-i="${i}">🪙 ${l.tarifa}</button></div></div>`;
      })
      .join('');
    const note = error ? `<p class="empty-note">${esc(OnlineService.describe(error))} para ver parejas de otros jugadores.</p>` : '';
    showModal({
      title: `💞 Parejas para ${esc(pet.name)}`,
      body: (rows || '<p class="empty-note">No hay parejas compatibles ahora mismo.</p>') + note,
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
    const r = await BreedingSystem.instance.breed(pet.id, partner, name);
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
