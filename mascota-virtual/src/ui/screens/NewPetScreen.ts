/** Elegir la primera mascota (o una nueva si se perdieron todas). */
import { pick } from '../../core/random';
import { DataRegistry } from '../../data/DataRegistry';
import { renderPetSVG } from '../../sprites/PetSprite';
import { PetManager } from '../../systems/pet/PetManager';
import { GrowthStage } from '../../systems/pet/PetTypes';
import type { Screen } from '../common';
import { esc, onAction } from '../dom';
import { showToast } from '../Overlay';

export class NewPetScreen implements Screen {
  id = 'new';
  private root!: HTMLElement;
  private speciesId = DataRegistry.instance.allSpecies()[0].id;

  constructor(private onDone: () => void) {}

  mount(root: HTMLElement): void {
    this.root = root;
    onAction(root, (act, t) => {
      if (act === 'species') {
        this.speciesId = t.dataset.id!;
        this.render();
      } else if (act === 'random-name') {
        (root.querySelector('#pet-name') as HTMLInputElement).value = pick(DataRegistry.instance.getSpecies(this.speciesId).nameSuggestions);
      } else if (act === 'create') {
        const name = (root.querySelector('#pet-name') as HTMLInputElement).value.trim();
        if (!name) {
          showToast('¡Ponle un nombre!', 'bad');
          return;
        }
        PetManager.instance.createStarter(this.speciesId, name);
        this.onDone();
      }
    });
    this.render();
  }

  render(): void {
    const all = DataRegistry.instance.allSpecies();
    const sel = DataRegistry.instance.getSpecies(this.speciesId);
    const previous = (this.root.querySelector('#pet-name') as HTMLInputElement | null)?.value ?? '';
    this.root.innerHTML = `
      <div class="new-pet">
        <h1 class="logo">🐾 Patitas</h1>
        <p>Elige tu mascota. La criarás desde bebé: aliméntala, juega, báñala, entrénala... ¡y compite!</p>
        <div class="species-grid">
          ${all
            .map(
              (s) => `<button class="species-card ${s.id === this.speciesId ? 'active' : ''}" data-act="species" data-id="${s.id}">
                ${renderPetSVG({ speciesId: s.id, genes: { primaryColor: s.primaryPalette[0], secondaryColor: s.secondaryPalette[0], pattern: 'plain', size: 1 }, stage: GrowthStage.Puppy, mood: s.id === this.speciesId ? 'happy' : 'normal' })}
                <b>${s.name}</b></button>`,
            )
            .join('')}
        </div>
        <div class="card"><b>${sel.icon} ${sel.name}</b><p>${esc(sel.description)}</p>
          <small>🏃 Agilidad base ${sel.baseAgility} · ✨ Belleza base ${sel.baseBeauty}</small></div>
        <label class="field"><span>Nombre</span>
          <div class="field-row"><input id="pet-name" maxlength="16" placeholder="${esc(sel.nameSuggestions[0])}" value="${esc(previous)}"/>
          <button class="btn" data-act="random-name">🎲</button></div></label>
        <p class="hint">El sexo se decide al nacer. 1 hora real = 1 día en el juego.</p>
        <button class="btn btn-primary btn-big" data-act="create">¡Adoptar!</button>
      </div>`;
  }
}
