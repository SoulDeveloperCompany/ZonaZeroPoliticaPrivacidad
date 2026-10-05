/**
 * Baño interactivo: la mascota va a la ducha.
 *  1. Frotar el jabón sobre la mascota hasta cubrirla de espuma.
 *  2. Pasar el agua de la ducha para quitar toda la espuma.
 * Al terminar se aplica la acción "bañar". Se puede salir en cualquier momento
 * (sin efecto ni tiempo de espera).
 */
import { InteractionSystem, describeFailure } from '../../systems/interaction/InteractionSystem';
import type { Pet } from '../../systems/pet/Pet';
import { petSVG } from '../common';
import { el, esc } from '../dom';
import { showToast } from '../Overlay';

/** Burbujas de espuma necesarias para pasar a aclarar. */
const FOAM_TARGET = 22;
/** Radio (px) que limpia el chorro de agua. */
const WATER_RADIUS = 42;

export function openBath(pet: Pet): Promise<boolean> {
  return new Promise((resolve) => {
    const scene = el('div', 'bath-scene');
    scene.innerHTML = `
      <div class="bath-top">
        <b>🛁 Hora del baño</b>
        <button class="btn btn-sm" data-exit>✕ Salir</button>
      </div>
      <div class="bath-step">1. Frota el jabón sobre ${esc(pet.name)} 🧼</div>
      <div class="bath-bar"><div class="bath-fill"></div></div>
      <div class="bath-stage">
        <div class="shower-head">🚿</div>
        <div class="bath-pet">${petSVG(pet)}</div>
        <div class="tub"></div>
        <div class="foam-layer"></div>
        <div class="tool-cursor">🧼</div>
      </div>
      <div class="bath-tools">
        <button class="bath-tool active" data-tool="soap">🧼 Jabón</button>
        <button class="bath-tool" data-tool="water" disabled>🚿 Agua</button>
      </div>`;
    document.body.appendChild(scene);

    const stage = scene.querySelector<HTMLElement>('.bath-stage')!;
    const petBox = scene.querySelector<HTMLElement>('.bath-pet')!;
    const foamLayer = scene.querySelector<HTMLElement>('.foam-layer')!;
    const cursor = scene.querySelector<HTMLElement>('.tool-cursor')!;
    const step = scene.querySelector<HTMLElement>('.bath-step')!;
    const fill = scene.querySelector<HTMLElement>('.bath-fill')!;
    const waterBtn = scene.querySelector<HTMLButtonElement>('[data-tool="water"]')!;

    let tool: 'soap' | 'water' = 'soap';
    let phase: 'soap' | 'rinse' | 'done' = 'soap';
    let pressing = false;
    const bubbles: { node: HTMLElement; x: number; y: number }[] = [];

    const close = (ok: boolean) => {
      scene.remove();
      resolve(ok);
    };

    const setTool = (t: 'soap' | 'water') => {
      tool = t;
      cursor.textContent = t === 'soap' ? '🧼' : '🚿';
      scene.querySelectorAll<HTMLElement>('.bath-tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
      if (t === 'water' && phase === 'soap') step.textContent = 'Primero llénalo de espuma con el jabón 🧼';
    };

    const updateBar = () => {
      const pct = phase === 'soap' ? bubbles.length / FOAM_TARGET : 1 - bubbles.length / FOAM_TARGET;
      fill.style.width = `${Math.min(100, Math.round(pct * 100))}%`;
      fill.classList.toggle('rinse', phase !== 'soap');
    };

    /** ¿El punto (relativo al escenario) está sobre la mascota? */
    const overPet = (x: number, y: number) => {
      const s = stage.getBoundingClientRect();
      const p = petBox.getBoundingClientRect();
      const cx = p.left - s.left + p.width / 2;
      const cy = p.top - s.top + p.height * 0.55;
      return ((x - cx) / (p.width * 0.36)) ** 2 + ((y - cy) / (p.height * 0.4)) ** 2 <= 1;
    };

    const addFoam = (x: number, y: number) => {
      if (!overPet(x, y) || bubbles.some((b) => Math.hypot(b.x - x, b.y - y) < 18)) return;
      const size = 26 + Math.random() * 18;
      const node = el('span', 'foam');
      node.style.cssText = `left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px`;
      foamLayer.appendChild(node);
      bubbles.push({ node, x, y });
      updateBar();
      if (bubbles.length >= FOAM_TARGET) {
        phase = 'rinse';
        waterBtn.disabled = false;
        setTool('water');
        step.textContent = '2. ¡Mucha espuma! Ahora pasa el agua para aclarar 🚿';
        updateBar();
      }
    };

    const rinse = (x: number, y: number) => {
      // Gotas que caen desde la ducha
      const drop = el('span', 'drop', '💧');
      drop.style.cssText = `left:${x - 8 + Math.random() * 16}px;top:${y + 10}px`;
      foamLayer.appendChild(drop);
      setTimeout(() => drop.remove(), 600);
      if (phase !== 'rinse') return;
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        if (Math.hypot(b.x - x, b.y - y) < WATER_RADIUS) {
          b.node.classList.add('pop');
          setTimeout(() => b.node.remove(), 300);
          bubbles.splice(i, 1);
        }
      }
      updateBar();
      if (bubbles.length === 0) finish();
    };

    const finish = () => {
      phase = 'done';
      const r = InteractionSystem.instance.perform(pet.id, 'bathe');
      if (!r.ok) {
        showToast(describeFailure(r), 'bad');
        close(false);
        return;
      }
      step.textContent = `✨ ¡${pet.name} quedó reluciente!`;
      petBox.classList.add('sparkle');
      for (let i = 0; i < 10; i++) {
        const s = el('span', 'shine', '✨');
        s.style.cssText = `left:${20 + Math.random() * 60}%;top:${20 + Math.random() * 50}%;animation-delay:${i * 60}ms`;
        stage.appendChild(s);
      }
      setTimeout(() => close(true), 1500);
    };

    const pos = (e: PointerEvent) => {
      const s = stage.getBoundingClientRect();
      return { x: e.clientX - s.left, y: e.clientY - s.top };
    };
    const moveCursor = (x: number, y: number) => {
      cursor.style.transform = `translate(${x - 22}px, ${y - 56}px)`;
    };

    stage.addEventListener('pointerdown', (e) => {
      if (phase === 'done') return;
      pressing = true;
      stage.setPointerCapture(e.pointerId);
      const { x, y } = pos(e);
      moveCursor(x, y);
      cursor.classList.add('on');
      if (tool === 'soap') addFoam(x, y - 30);
      else rinse(x, y - 30);
    });
    stage.addEventListener('pointermove', (e) => {
      const { x, y } = pos(e);
      moveCursor(x, y);
      if (!pressing || phase === 'done') return;
      // El jabón/agua actúa un poco por encima del dedo, para que se vea
      if (tool === 'soap') addFoam(x, y - 30);
      else rinse(x, y - 30);
    });
    const release = () => {
      pressing = false;
      cursor.classList.remove('on');
    };
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);

    scene.querySelector('[data-exit]')!.addEventListener('click', () => close(false));
    scene.querySelectorAll<HTMLButtonElement>('.bath-tool').forEach((b) =>
      b.addEventListener('click', () => setTool(b.dataset.tool as 'soap' | 'water')),
    );
  });
}
