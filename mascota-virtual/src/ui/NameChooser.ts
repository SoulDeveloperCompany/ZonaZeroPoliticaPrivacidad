/**
 * Selector de nombre con dos opciones: escribir uno personalizado o
 * generar uno aleatorio. Se usa al adoptar, al nacer una cría y al renombrar.
 */
import { randomName } from '../data/names';
import { esc } from './dom';
import { showModal, showToast } from './Overlay';

export class NameChooser {
  private mode: 'custom' | 'random' = 'custom';
  private random: string;

  constructor(
    private root: HTMLElement,
    private speciesId?: string,
    initial = '',
    /** Se llama cada vez que cambia si hay un nombre válido. */
    private onChange?: (valid: boolean) => void,
  ) {
    this.random = randomName(speciesId);
    root.classList.add('name-chooser');
    root.innerHTML = `
      <div class="seg" role="tablist">
        <button type="button" class="seg-btn active" data-mode="custom">✏️ Personalizado</button>
        <button type="button" class="seg-btn" data-mode="random">🎲 Aleatorio</button>
      </div>
      <div class="name-custom">
        <input id="name-input" type="text" maxlength="16" autocomplete="off" placeholder="Escribe su nombre" value="${esc(initial)}"/>
      </div>
      <div class="name-random" hidden>
        <span class="random-name">${esc(this.random)}</span>
        <button type="button" class="btn btn-sm" data-reroll>🎲 Otro</button>
      </div>`;
    root.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const seg = t.closest<HTMLElement>('.seg-btn');
      if (seg) this.setMode(seg.dataset.mode as 'custom' | 'random');
      if (t.closest('[data-reroll]')) {
        this.random = randomName(this.speciesId, this.random);
        root.querySelector('.random-name')!.textContent = this.random;
      }
    });
    root.querySelector('#name-input')!.addEventListener('input', () => this.notify());
    queueMicrotask(() => this.notify());
  }

  private notify(): void {
    this.onChange?.(this.value().length > 0);
  }

  /** Cambia de especie (en la pantalla de adopción) y regenera el aleatorio. */
  setSpecies(speciesId: string): void {
    this.speciesId = speciesId;
    this.random = randomName(speciesId);
    this.root.querySelector('.random-name')!.textContent = this.random;
  }

  private setMode(mode: 'custom' | 'random'): void {
    this.mode = mode;
    this.root.querySelectorAll<HTMLElement>('.seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    (this.root.querySelector('.name-custom') as HTMLElement).hidden = mode !== 'custom';
    (this.root.querySelector('.name-random') as HTMLElement).hidden = mode !== 'random';
    if (mode === 'custom') (this.root.querySelector('#name-input') as HTMLInputElement).focus();
    this.notify();
  }

  /** Nombre elegido ('' si el modo personalizado está vacío). */
  value(): string {
    return this.mode === 'random' ? this.random : (this.root.querySelector('#name-input') as HTMLInputElement).value.trim();
  }
}

/** Ventana para elegir nombre. Resuelve null si se cancela. */
export function chooseName(title: string, speciesId?: string, current = ''): Promise<string | null> {
  return new Promise((resolve) => {
    let chooser: NameChooser;
    let done = false;
    const finish = (v: string | null) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    const modal = showModal({
      title,
      body: '<div class="name-slot"></div>',
      buttons: [
        { label: 'Cancelar', act: 'cancel' },
        { label: 'Aceptar', act: 'ok', primary: true },
      ],
      onAction: (act) => {
        if (act === 'cancel') return finish(null);
        if (act !== 'ok') return;
        const name = chooser.value();
        if (!name) {
          showToast('Escribe un nombre o usa uno aleatorio', 'bad');
          return true; // no cerrar
        }
        finish(name);
      },
    });
    const okBtn = modal.root.querySelector<HTMLElement>('[data-act="ok"]')!;
    chooser = new NameChooser(modal.body.querySelector('.name-slot') as HTMLElement, speciesId, current, (valid) =>
      okBtn.classList.toggle('btn-off', !valid),
    );
    // Cerrar tocando fuera = cancelar
    const obs = new MutationObserver(() => {
      if (!modal.root.isConnected) {
        obs.disconnect();
        finish(null);
      }
    });
    obs.observe(modal.root.parentElement!, { childList: true });
  });
}
