/** Elegir la primera mascota (o una nueva si se perdieron todas). */
import { DataRegistry } from '../../data/DataRegistry';
import { renderPetSVG } from '../../sprites/PetSprite';
import { PetManager } from '../../systems/pet/PetManager';
import { GrowthStage } from '../../systems/pet/PetTypes';
import type { Screen } from '../common';
import { esc, onAction } from '../dom';
import { NameChooser } from '../NameChooser';
import { showToast } from '../Overlay';

export class NewPetScreen implements Screen {
  id = 'new';
  private root!: HTMLElement;
  private speciesId = DataRegistry.instance.allSpecies()[0].id;
  private chooser!: NameChooser;

  constructor(private onDone: () => void) {}

  mount(root: HTMLElement): void {
    this.root = root;
    root.innerHTML = `
      <div class="new-pet">
        <h1 class="logo">🐾 Patitas</h1>
        <p>Elige tu mascota. La criarás desde bebé: aliméntala, juega, báñala, entrénala... ¡y compite!</p>
        <div class="species-slot"></div>
        <div class="field"><span>Nombre</span><div class="name-slot"></div></div>
        <p class="hint">El sexo se decide al nacer. 1 hora real = 1 día en el juego.</p>
        <button class="btn btn-primary btn-big" data-act="create">¡Adoptar!</button>
      </div>`;
    this.chooser = new NameChooser(root.querySelector('.name-slot') as HTMLElement, this.speciesId);
    onAction(root, (act, t) => {
      if (act === 'species') {
        this.speciesId = t.dataset.id!;
        this.chooser.setSpecies(this.speciesId);
        this.renderSpecies();
      } else if (act === 'create') {
        const name = this.chooser.value();
        if (!name) {
          showToast('Escribe un nombre o usa uno aleatorio', 'bad');
          return;
        }
        PetManager.instance.createStarter(this.speciesId, name);
        this.onDone();
      }
    });
    this.renderSpecies();
  }

  private renderSpecies(): void {
    const all = DataRegistry.instance.allSpecies();
    const sel = DataRegistry.instance.getSpecies(this.speciesId);
    (this.root.querySelector('.species-slot') as HTMLElement).innerHTML = `
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
        <small>🏃 Agilidad base ${sel.baseAgility} · ✨ Belleza base ${sel.baseBeauty}</small></div>`;
  }
}
