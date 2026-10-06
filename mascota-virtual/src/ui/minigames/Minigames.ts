/**
 * Minijuegos de las competencias. Cada uno se monta en un contenedor y
 * resuelve una promesa con el rendimiento del jugador (0 a 1).
 *
 * Para añadir un minijuego: crea una función `(stage, pet) => Promise<number>`
 * y regístrala en `MINIGAMES` con el `minigame` de la competencia.
 */
import type { MinigameType } from '../../data/types';
import type { Pet } from '../../systems/pet/Pet';
import { petSVG } from '../common';
import { el, wait } from '../dom';

export type Minigame = (stage: HTMLElement, pet: Pet) => Promise<number>;

/** Cuenta atrás 3-2-1 antes de empezar. */
async function countdown(stage: HTMLElement, text: string): Promise<void> {
  const box = el('div', 'mg-countdown');
  stage.appendChild(box);
  for (const t of [text, '3', '2', '1', '¡YA!']) {
    box.textContent = t;
    await wait(t === text ? 1400 : 600);
  }
  box.remove();
}

// ------------------------------------------------------------------
// Carrera de agilidad: toca para saltar los obstáculos
// ------------------------------------------------------------------
const agility: Minigame = (stage, pet) =>
  new Promise((resolve) => {
    stage.innerHTML = `
      <div class="mg-hud"><span class="mg-score">0 / 0</span><span class="mg-help">Toca para saltar</span></div>
      <div class="mg-track"><div class="mg-runner">${petSVG(pet)}</div><div class="mg-ground"></div></div>`;
    const track = stage.querySelector<HTMLElement>('.mg-track')!;
    const runner = stage.querySelector<HTMLElement>('.mg-runner')!;
    const hud = stage.querySelector<HTMLElement>('.mg-score')!;

    // La agilidad de la mascota hace el salto un poco más largo (ayuda)
    const TOTAL = 12;
    const jumpTime = 650 + pet.stats.agility * 2.5;
    let jumpStart = -1;
    let spawned = 0;
    let cleared = 0;
    let passed = 0;
    let nextSpawn = 600;
    let last = 0;
    let running = false;
    const obstacles: { node: HTMLElement; x: number; hit: boolean; done: boolean }[] = [];

    const jump = () => {
      if (running && jumpStart < 0) jumpStart = performance.now();
    };
    stage.addEventListener('pointerdown', jump);

    const frame = (t: number) => {
      if (!running) return;
      const dt = last ? Math.min(50, t - last) : 16;
      last = t;
      const width = track.clientWidth;
      const speed = width * (0.42 + spawned * 0.015); // px/s, acelera poco a poco

      // Salto parabólico
      let height = 0;
      if (jumpStart >= 0) {
        const p = (t - jumpStart) / jumpTime;
        if (p >= 1) jumpStart = -1;
        else height = Math.sin(p * Math.PI) * 110;
      }
      runner.style.transform = `translateY(${-height}px)`;

      // Generar obstáculos
      nextSpawn -= dt;
      if (spawned < TOTAL && nextSpawn <= 0) {
        const node = el('div', 'mg-obstacle', ['🪵', '🪨', '🌵', '🚧'][spawned % 4]);
        track.appendChild(node);
        obstacles.push({ node, x: width + 20, hit: false, done: false });
        spawned++;
        nextSpawn = 900 + Math.random() * 700 - spawned * 20;
      }

      // Mover y detectar choques (la mascota ocupa ~ x 40-100 px)
      for (const o of obstacles) {
        if (o.done) continue;
        o.x -= (speed * dt) / 1000;
        o.node.style.transform = `translateX(${o.x}px)`;
        if (!o.hit && o.x < 92 && o.x > 30 && height < 40) {
          o.hit = true;
          o.node.classList.add('hit');
          runner.classList.add('mg-hurt');
          setTimeout(() => runner.classList.remove('mg-hurt'), 300);
        }
        if (o.x < 20) {
          o.done = true;
          passed++;
          if (!o.hit) cleared++;
          o.node.remove();
          hud.textContent = `${cleared} / ${passed}`;
        }
      }

      if (passed >= TOTAL) {
        running = false;
        stage.removeEventListener('pointerdown', jump);
        resolve(cleared / TOTAL);
        return;
      }
      requestAnimationFrame(frame);
    };

    countdown(stage, '¡Salta los obstáculos!').then(() => {
      running = true;
      requestAnimationFrame(frame);
    });
  });

// ------------------------------------------------------------------
// Concurso de belleza: toca cuando el indicador esté en la zona dorada
// ------------------------------------------------------------------
const beauty: Minigame = (stage, pet) =>
  new Promise((resolve) => {
    stage.innerHTML = `
      <div class="mg-hud"><span class="mg-score">Pose 1 / 5</span><span class="mg-help">Toca en la zona dorada</span></div>
      <div class="mg-runway"><div class="mg-model">${petSVG(pet)}</div></div>
      <div class="mg-meter"><div class="mg-zone"></div><div class="mg-marker"></div></div>
      <div class="mg-judges"></div>`;
    const model = stage.querySelector<HTMLElement>('.mg-model')!;
    const zone = stage.querySelector<HTMLElement>('.mg-zone')!;
    const marker = stage.querySelector<HTMLElement>('.mg-marker')!;
    const hud = stage.querySelector<HTMLElement>('.mg-score')!;
    const judges = stage.querySelector<HTMLElement>('.mg-judges')!;

    const ROUNDS = 5;
    let round = 0;
    let total = 0;
    let pos = 0;
    let dir = 1;
    let zoneStart = 0;
    let zoneWidth = 0;
    let active = false;
    let last = 0;

    const newRound = () => {
      zoneWidth = 0.22 - round * 0.03; // cada pose es más difícil
      zoneStart = 0.1 + Math.random() * (0.8 - zoneWidth);
      zone.style.left = `${zoneStart * 100}%`;
      zone.style.width = `${zoneWidth * 100}%`;
      hud.textContent = `Pose ${round + 1} / ${ROUNDS}`;
      active = true;
    };

    const tap = () => {
      if (!active) return;
      active = false;
      const center = zoneStart + zoneWidth / 2;
      const dist = Math.abs(pos - center);
      // 1 punto en el centro, 0 a dos anchos de zona
      const score = Math.max(0, 1 - dist / zoneWidth);
      total += score;
      const label = score > 0.75 ? '¡Perfecto! 🌟' : score > 0.4 ? '¡Bien! 👍' : score > 0 ? 'Regular 😅' : '¡Ups! 🙈';
      judges.textContent = label;
      model.classList.remove('anim-pose');
      void model.offsetWidth;
      if (score > 0.4) model.classList.add('anim-pose');
      round++;
      setTimeout(() => {
        if (round >= ROUNDS) {
          stage.removeEventListener('pointerdown', tap);
          resolve(total / ROUNDS);
        } else newRound();
      }, 800);
    };
    stage.addEventListener('pointerdown', tap);

    const frame = (t: number) => {
      if (round >= ROUNDS) return;
      const dt = last ? Math.min(50, t - last) : 16;
      last = t;
      if (active) {
        const speed = 0.7 + round * 0.18; // anchos por segundo
        pos += (dir * speed * dt) / 1000;
        if (pos > 1) {
          pos = 1;
          dir = -1;
        } else if (pos < 0) {
          pos = 0;
          dir = 1;
        }
        marker.style.left = `${pos * 100}%`;
      }
      requestAnimationFrame(frame);
    };

    countdown(stage, '¡A la pasarela!').then(() => {
      newRound();
      requestAnimationFrame(frame);
    });
  });

// ------------------------------------------------------------------
// Show de trucos: memoriza y repite la secuencia
// ------------------------------------------------------------------
const tricks: Minigame = (stage, pet) =>
  new Promise((resolve) => {
    const icons = pet.species.tricks.map((t) => t.icon).slice(0, 4);
    while (icons.length < 4) icons.push(['⬆️', '➡️', '⬇️', '⬅️'][icons.length]);
    stage.innerHTML = `
      <div class="mg-hud"><span class="mg-score">Ronda 1</span><span class="mg-help">Repite la secuencia</span></div>
      <div class="mg-performer">${petSVG(pet)}</div>
      <div class="mg-pads">${icons.map((ic, i) => `<button class="mg-pad" data-i="${i}" disabled>${ic}</button>`).join('')}</div>`;
    const pads = [...stage.querySelectorAll<HTMLButtonElement>('.mg-pad')];
    const hud = stage.querySelector<HTMLElement>('.mg-score')!;
    const performer = stage.querySelector<HTMLElement>('.mg-performer')!;

    const LENGTHS = [3, 4, 5, 6];
    const maxPoints = LENGTHS.reduce((a, b) => a + b, 0);
    let points = 0;

    const flash = async (i: number, ms = 420) => {
      pads[i].classList.add('lit');
      await wait(ms);
      pads[i].classList.remove('lit');
      await wait(140);
    };

    const playRound = async (len: number): Promise<boolean> => {
      const seq = Array.from({ length: len }, () => Math.floor(Math.random() * 4));
      pads.forEach((p) => (p.disabled = true));
      await wait(500);
      for (const i of seq) await flash(i, 480 - len * 30);
      pads.forEach((p) => (p.disabled = false));
      return new Promise((done) => {
        let idx = 0;
        const onTap = (e: Event) => {
          const i = Number((e.currentTarget as HTMLElement).dataset.i);
          void flash(i, 180);
          if (i === seq[idx]) {
            idx++;
            points++;
            performer.classList.remove('anim-spin');
            void performer.offsetWidth;
            performer.classList.add('anim-spin');
            if (idx === seq.length) finish(true);
          } else finish(false);
        };
        const finish = (ok: boolean) => {
          pads.forEach((p) => p.removeEventListener('click', onTap));
          pads.forEach((p) => (p.disabled = true));
          hud.textContent = ok ? '¡Bravo! 👏' : '¡Fallo! 😵';
          setTimeout(() => done(ok), 700);
        };
        pads.forEach((p) => p.addEventListener('click', onTap));
      });
    };

    countdown(stage, '¡Memoriza los trucos!').then(async () => {
      for (let r = 0; r < LENGTHS.length; r++) {
        hud.textContent = `Ronda ${r + 1} / ${LENGTHS.length}`;
        const ok = await playRound(LENGTHS[r]);
        if (!ok) break;
      }
      resolve(points / maxPoints);
    });
  });

export const MINIGAMES: Record<MinigameType, Minigame> = { agility, beauty, tricks };
