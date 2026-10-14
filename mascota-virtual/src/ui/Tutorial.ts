/**
 * Primera sesión guiada (Auditoría P6). Solo se muestra una vez (GameState.tutorialDone).
 *   1. Dar de comer (señala el botón Alimentar)   2. Acariciar (señala a la mascota)
 *   3. Regalo de bienvenida (una flor puesta) y explicación del tiempo: crece en días reales
 *      y nunca enferma ni se va mientras el jugador no está.
 * Cada paso se registra en las estadísticas anónimas para ver dónde se atasca la gente.
 */
import { EventBus } from '../core/EventBus';
import { GameState } from '../core/GameState';
import { AlbumSystem } from '../systems/save/AlbumSystem';
import { EconomySystem } from '../systems/economy/EconomySystem';
import { Analytics } from '../systems/online/Analytics';
import { PetManager } from '../systems/pet/PetManager';
import { celebrate } from './Celebration';
import { esc } from './dom';

const REGALO = 'acc_flower';

export class Tutorial {
  private bubble: HTMLElement | null = null;
  private off: (() => void) | null = null;
  private step = 0;

  /** Arranca el tutorial si toca (primera partida). */
  static maybeStart(): void {
    if (GameState.instance.data.tutorialDone || !PetManager.instance.selected) return;
    new Tutorial().start();
  }

  private start(): void {
    this.off = EventBus.instance.on('interaction:performed', ({ actionId }) => {
      if (this.step === 1 && actionId === 'feed') this.show(2);
      else if (this.step === 2 && actionId === 'pet') this.finish();
    });
    this.show(1);
  }

  private show(step: number): void {
    this.step = step;
    Analytics.instance.track('tutorial_paso', String(step));
    const pet = PetManager.instance.selected!;
    const textos: Record<number, [string, string]> = {
      1: [`🍖 ${esc(pet.name)} tiene hambre. Toca <b>Alimentar</b> y arrastra la comida hasta su boca.`, '.dock-btn[data-id="feed"]'],
      2: ['✋ ¡Muy bien! Ahora <b>acaríciale</b>: pasa el dedo por encima.', '.pet-sprite'],
    };
    const [html, target] = textos[step];
    document.querySelectorAll('.coach-target').forEach((e) => e.classList.remove('coach-target'));
    document.querySelector(target)?.classList.add('coach-target');
    if (!this.bubble) {
      this.bubble = document.createElement('div');
      this.bubble.className = 'coach-bubble';
      document.body.appendChild(this.bubble);
    }
    this.bubble.innerHTML = `<span>${html}</span><button class="coach-skip" aria-label="Saltar tutorial">Saltar</button>`;
    this.bubble.querySelector('.coach-skip')!.addEventListener('click', () => this.finish(true));
  }

  private finish(saltado = false): void {
    this.off?.();
    this.bubble?.remove();
    document.querySelectorAll('.coach-target').forEach((e) => e.classList.remove('coach-target'));
    GameState.instance.data.tutorialDone = true;
    Analytics.instance.track(saltado ? 'tutorial_saltado' : 'tutorial_fin', String(this.step));
    const pet = PetManager.instance.selected;
    if (!pet || saltado) return;
    const eco = EconomySystem.instance;
    eco.addItem(REGALO, 1);
    eco.equip(pet.id, REGALO);
    AlbumSystem.instance.add(pet, 'gift', '¡Bienvenida a casa!', `El primer día de ${pet.name} contigo. Le regalaste una flor.`);
    celebrate({
      pet,
      title: '🌸 ¡Lo haces genial!',
      text: `Un regalo de bienvenida: una <b>flor</b> para ${esc(pet.name)}.`,
      extra: `<div class="unlock-list">⏳ ${esc(pet.name)} crece en <b>días reales</b>: mañana ya será cachorro.<br>
        😌 Puedes cerrar el juego tranquilo: mientras no estás nunca enferma ni se va de casa.</div>`,
    });
  }
}
