/** Álbum de recuerdos: los momentos clave de cada mascota. */
import { renderPetSVG } from '../../sprites/PetSprite';
import { AlbumSystem } from '../../systems/save/AlbumSystem';
import type { Screen } from '../common';
import { esc, formatDate, onAction } from '../dom';

export class AlbumScreen implements Screen {
  id = 'album';
  private root!: HTMLElement;
  private filter: string | null = null;

  mount(root: HTMLElement): void {
    this.root = root;
    onAction(root, (act, t) => {
      if (act === 'filter') {
        this.filter = t.dataset.id || null;
        this.render();
      }
    });
    this.render();
  }

  render(): void {
    const all = AlbumSystem.instance.list();
    const names = new Map(all.map((m) => [m.petId, m.petName]));
    const list = this.filter ? all.filter((m) => m.petId === this.filter) : all;
    this.root.innerHTML = `
      <h2 class="screen-title">📸 Álbum de recuerdos</h2>
      <div class="tabs">
        <button class="tab ${!this.filter ? 'active' : ''}" data-act="filter" data-id="">Todos</button>
        ${[...names].map(([id, name]) => `<button class="tab ${this.filter === id ? 'active' : ''}" data-act="filter" data-id="${id}">${esc(name)}</button>`).join('')}
      </div>
      <div class="album">
        ${list
          .map(
            (m) => `<div class="memory">
              <div class="memory-photo">${renderPetSVG({ speciesId: m.snapshot.speciesId, genes: m.snapshot.genes, stage: m.snapshot.stage, equipped: m.snapshot.equipped, mood: m.kind === 'escape' ? 'sad' : 'happy' })}
                <span class="memory-icon">${AlbumSystem.iconFor(m.kind)}</span></div>
              <div class="memory-text"><b>${esc(m.title)}</b><p>${esc(m.text)}</p><small>${esc(m.petName)} · ${formatDate(m.at)}</small></div>
            </div>`,
          )
          .join('') || '<p class="hint center">Aún no hay recuerdos.</p>'}
      </div>`;
  }
}
