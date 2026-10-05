/**
 * Minijuegos de "Jugar". Cada uno se monta en un contenedor y devuelve la
 * puntuación (número entero) al terminar.
 * Para añadir uno: escribe la función y regístrala en `PLAY_MINIGAMES`
 * con el mismo id que en `src/data/games.ts`.
 */
import type { Pet } from '../../systems/pet/Pet';
import { petSVG } from '../common';
import { el, wait } from '../dom';
import { MINIGAMES } from './Minigames';

export type PlayMinigame = (stage: HTMLElement, pet: Pet) => Promise<number>;

async function countdown(stage: HTMLElement, text: string): Promise<void> {
  const box = el('div', 'mg-countdown');
  stage.appendChild(box);
  for (const t of [text, '3', '2', '1', '¡YA!']) {
    box.textContent = t;
    await wait(t === text ? 1300 : 550);
  }
  box.remove();
}

// ------------------------------------------------------------------
// Burbujas (Bebé): tocar burbujas que suben durante 20 s
// ------------------------------------------------------------------
const bubbles: PlayMinigame = (stage, pet) =>
  new Promise((resolve) => {
    stage.innerHTML = `
      <div class="mg-hud"><span class="mg-score">🫧 0</span><span class="mg-time">20s</span></div>
      <div class="pg-field bubbles-field"><div class="pg-pet">${petSVG(pet)}</div></div>`;
    const field = stage.querySelector<HTMLElement>('.pg-field')!;
    const hud = stage.querySelector<HTMLElement>('.mg-score')!;
    const timeEl = stage.querySelector<HTMLElement>('.mg-time')!;
    let score = 0;
    let running = true;

    const spawn = () => {
      if (!running) return;
      const size = 44 + Math.random() * 30;
      const b = el('button', 'bubble');
      const golden = Math.random() < 0.08;
      if (golden) b.classList.add('golden');
      b.style.cssText = `width:${size}px;height:${size}px;left:${Math.random() * 82}%;animation-duration:${3.2 + Math.random() * 2.2}s`;
      b.addEventListener('pointerdown', () => {
        if (b.classList.contains('pop')) return;
        score += golden ? 3 : 1;
        hud.textContent = `🫧 ${score}`;
        b.classList.add('pop');
        setTimeout(() => b.remove(), 200);
      });
      b.addEventListener('animationend', () => b.remove());
      field.appendChild(b);
      setTimeout(spawn, 380 + Math.random() * 380);
    };

    countdown(stage, '¡Revienta las burbujas!').then(async () => {
      spawn();
      for (let t = 20; t > 0; t--) {
        timeEl.textContent = `${t}s`;
        await wait(1000);
      }
      running = false;
      resolve(score);
    });
  });

// ------------------------------------------------------------------
// Encuentra la pelota (Bebé): 3 vasos que se mezclan, 5 rondas
// ------------------------------------------------------------------
const cups: PlayMinigame = (stage) =>
  new Promise((resolve) => {
    stage.innerHTML = `
      <div class="mg-hud"><span class="mg-score">Ronda 1 / 5</span><span class="mg-help">¿Dónde está la pelota?</span></div>
      <div class="cups-row">${[0, 1, 2].map((i) => `<button class="cup" data-i="${i}" disabled><span class="cup-body">🥤</span><span class="cup-ball">⚽</span></button>`).join('')}</div>
      <div class="mg-judges"></div>`;
    const cupEls = [...stage.querySelectorAll<HTMLButtonElement>('.cup')];
    const hud = stage.querySelector<HTMLElement>('.mg-score')!;
    const judge = stage.querySelector<HTMLElement>('.mg-judges')!;
    let hits = 0;
    // pos[i] = hueco (0-2) donde está el vaso i
    const pos = [0, 1, 2];
    const place = () => cupEls.forEach((c, i) => (c.style.transform = `translateX(${(pos[i] - 1) * 110}%)`));
    place();

    const round = async (r: number): Promise<void> => {
      hud.textContent = `Ronda ${r + 1} / 5`;
      judge.textContent = 'Mira bien...';
      const ball = Math.floor(Math.random() * 3);
      cupEls.forEach((c, i) => c.classList.toggle('has-ball', i === ball));
      cupEls.forEach((c) => c.classList.add('lift'));
      await wait(1000);
      cupEls.forEach((c) => c.classList.remove('lift'));
      await wait(350);
      const swaps = 4 + r * 2;
      const speed = Math.max(170, 420 - r * 60);
      cupEls.forEach((c) => (c.style.transitionDuration = `${speed}ms`));
      for (let s = 0; s < swaps; s++) {
        const a = Math.floor(Math.random() * 3);
        const b = (a + 1 + Math.floor(Math.random() * 2)) % 3;
        [pos[a], pos[b]] = [pos[b], pos[a]];
        place();
        await wait(speed + 40);
      }
      judge.textContent = 'Toca el vaso';
      cupEls.forEach((c) => (c.disabled = false));
      const chosen = await new Promise<number>((done) =>
        cupEls.forEach((c, i) => (c.onclick = () => done(i))),
      );
      cupEls.forEach((c) => {
        c.disabled = true;
        c.onclick = null;
        c.classList.add('lift');
      });
      const ok = chosen === ball;
      if (ok) hits++;
      judge.textContent = ok ? '¡Bien! 🎉' : '¡Ups! Estaba aquí 👆';
      await wait(1100);
      cupEls.forEach((c) => c.classList.remove('lift'));
      await wait(300);
    };

    countdown(stage, '¡Sigue la pelota!').then(async () => {
      for (let r = 0; r < 5; r++) await round(r);
      resolve(hits);
    });
  });

// ------------------------------------------------------------------
// Atrapa golosinas (Cachorro): mover a la mascota con el dedo
// ------------------------------------------------------------------
const GOOD = ['🍖', '🍪', '🦴', '🍓', '🥕', '🐟'];
const BAD = ['🥦', '🌶️'];
const catchGame: PlayMinigame = (stage, pet) =>
  new Promise((resolve) => {
    stage.innerHTML = `
      <div class="mg-hud"><span class="mg-score">🍬 0</span><span class="mg-time">25s</span></div>
      <div class="pg-field catch-field"><div class="catcher">${petSVG(pet)}</div></div>
      <p class="hint center">Arrastra el dedo para moverte</p>`;
    const field = stage.querySelector<HTMLElement>('.pg-field')!;
    const catcher = stage.querySelector<HTMLElement>('.catcher')!;
    const hud = stage.querySelector<HTMLElement>('.mg-score')!;
    const timeEl = stage.querySelector<HTMLElement>('.mg-time')!;
    let x = 0.5;
    let score = 0;
    let running = false;
    let last = 0;
    let spawnIn = 0;
    const items: { node: HTMLElement; x: number; y: number; v: number; good: boolean }[] = [];

    field.addEventListener('pointermove', (e) => {
      const r = field.getBoundingClientRect();
      x = Math.min(0.92, Math.max(0.08, (e.clientX - r.left) / r.width));
    });
    field.addEventListener('pointerdown', (e) => {
      const r = field.getBoundingClientRect();
      x = Math.min(0.92, Math.max(0.08, (e.clientX - r.left) / r.width));
    });

    const frame = (t: number) => {
      if (!running) return;
      const dt = last ? Math.min(50, t - last) / 1000 : 0.016;
      last = t;
      const w = field.clientWidth;
      const h = field.clientHeight;
      catcher.style.transform = `translateX(${x * w - 45}px)`;
      spawnIn -= dt;
      if (spawnIn <= 0) {
        const good = Math.random() > 0.22;
        const node = el('span', 'falling', good ? GOOD[Math.floor(Math.random() * GOOD.length)] : BAD[Math.floor(Math.random() * BAD.length)]);
        field.appendChild(node);
        items.push({ node, x: 0.06 + Math.random() * 0.88, y: -30, v: h * (0.35 + Math.random() * 0.25), good });
        spawnIn = 0.55 + Math.random() * 0.35;
      }
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.y += it.v * dt;
        it.node.style.transform = `translate(${it.x * w - 16}px, ${it.y}px)`;
        if (it.y > h - 95 && it.y < h - 40 && Math.abs(it.x - x) < 0.13) {
          score += it.good ? 1 : -2;
          hud.textContent = `🍬 ${score}`;
          catcher.classList.remove('yum', 'yuck');
          void catcher.offsetWidth;
          catcher.classList.add(it.good ? 'yum' : 'yuck');
          it.node.remove();
          items.splice(i, 1);
        } else if (it.y > h) {
          it.node.remove();
          items.splice(i, 1);
        }
      }
      requestAnimationFrame(frame);
    };

    countdown(stage, '¡Atrapa la comida!').then(async () => {
      running = true;
      requestAnimationFrame(frame);
      for (let s = 25; s > 0; s--) {
        timeEl.textContent = `${s}s`;
        await wait(1000);
      }
      running = false;
      resolve(Math.max(0, score));
    });
  });

// ------------------------------------------------------------------
// Memoria (Cachorro): 6 parejas; menos intentos = más puntos
// ------------------------------------------------------------------
const memory: PlayMinigame = (stage) =>
  new Promise((resolve) => {
    const faces = ['🐶', '🐱', '🐰', '🦜', '🐢', '🐹'];
    const deck = [...faces, ...faces].sort(() => Math.random() - 0.5);
    stage.innerHTML = `
      <div class="mg-hud"><span class="mg-score">Intentos: 0</span><span class="mg-help">Encuentra las parejas</span></div>
      <div class="memory-grid">${deck.map((f, i) => `<button class="mem-card" data-i="${i}"><span class="mem-back">🐾</span><span class="mem-face">${f}</span></button>`).join('')}</div>`;
    const cards = [...stage.querySelectorAll<HTMLButtonElement>('.mem-card')];
    const hud = stage.querySelector<HTMLElement>('.mg-score')!;
    let open: number[] = [];
    let tries = 0;
    let found = 0;
    let busy = false;
    cards.forEach((c, i) =>
      c.addEventListener('click', async () => {
        if (busy || c.classList.contains('flip') || open.includes(i)) return;
        c.classList.add('flip');
        open.push(i);
        if (open.length < 2) return;
        tries++;
        hud.textContent = `Intentos: ${tries}`;
        const [a, b] = open;
        if (deck[a] === deck[b]) {
          cards[a].classList.add('done');
          cards[b].classList.add('done');
          found++;
          open = [];
          if (found === faces.length) {
            await wait(600);
            // 6 intentos (perfecto) = 100 puntos; cada intento extra resta 6
            resolve(Math.max(10, 100 - (tries - faces.length) * 6));
          }
        } else {
          busy = true;
          await wait(750);
          cards[a].classList.remove('flip');
          cards[b].classList.remove('flip');
          open = [];
          busy = false;
        }
      }),
    );
  });

// ------------------------------------------------------------------
// Saltarín (Juvenil): carrera sin fin con 3 vidas
// ------------------------------------------------------------------
const runner: PlayMinigame = (stage, pet) =>
  new Promise((resolve) => {
    stage.innerHTML = `
      <div class="mg-hud"><span class="mg-score">Saltos: 0</span><span class="mg-lives">❤️❤️❤️</span></div>
      <div class="mg-track"><div class="mg-runner">${petSVG(pet)}</div><div class="mg-ground"></div></div>
      <p class="hint center">Toca para saltar</p>`;
    const track = stage.querySelector<HTMLElement>('.mg-track')!;
    const runnerEl = stage.querySelector<HTMLElement>('.mg-runner')!;
    const hud = stage.querySelector<HTMLElement>('.mg-score')!;
    const livesEl = stage.querySelector<HTMLElement>('.mg-lives')!;
    const jumpTime = 650 + pet.stats.agility * 2.5;
    let jumpStart = -1;
    let lives = 3;
    let jumps = 0;
    let spawned = 0;
    let nextSpawn = 700;
    let last = 0;
    let running = false;
    const obstacles: { node: HTMLElement; x: number; hit: boolean }[] = [];
    const jump = () => {
      if (running && jumpStart < 0) jumpStart = performance.now();
    };
    stage.addEventListener('pointerdown', jump);

    const frame = (t: number) => {
      if (!running) return;
      const dt = last ? Math.min(50, t - last) : 16;
      last = t;
      const width = track.clientWidth;
      const speed = width * Math.min(0.85, 0.42 + spawned * 0.012);
      let height = 0;
      if (jumpStart >= 0) {
        const p = (t - jumpStart) / jumpTime;
        if (p >= 1) jumpStart = -1;
        else height = Math.sin(p * Math.PI) * 110;
      }
      runnerEl.style.transform = `translateY(${-height}px)`;
      nextSpawn -= dt;
      if (nextSpawn <= 0) {
        const node = el('div', 'mg-obstacle', ['🪵', '🪨', '🌵', '🚧'][spawned % 4]);
        track.appendChild(node);
        obstacles.push({ node, x: width + 20, hit: false });
        spawned++;
        nextSpawn = Math.max(650, 1300 - spawned * 18) + Math.random() * 600;
      }
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        o.x -= (speed * dt) / 1000;
        o.node.style.transform = `translateX(${o.x}px)`;
        if (!o.hit && o.x < 92 && o.x > 30 && height < 40) {
          o.hit = true;
          o.node.classList.add('hit');
          lives--;
          livesEl.textContent = '❤️'.repeat(lives) + '🤍'.repeat(3 - lives);
          runnerEl.classList.add('mg-hurt');
          setTimeout(() => runnerEl.classList.remove('mg-hurt'), 300);
        }
        if (o.x < 20) {
          if (!o.hit) jumps++;
          hud.textContent = `Saltos: ${jumps}`;
          o.node.remove();
          obstacles.splice(i, 1);
        }
      }
      if (lives <= 0) {
        running = false;
        stage.removeEventListener('pointerdown', jump);
        setTimeout(() => resolve(jumps), 500);
        return;
      }
      requestAnimationFrame(frame);
    };
    countdown(stage, '¡Salta sin parar!').then(() => {
      running = true;
      requestAnimationFrame(frame);
    });
  });

// ------------------------------------------------------------------
// Ensayo de trucos (Juvenil): reutiliza el minijuego de memoria de trucos
// ------------------------------------------------------------------
const tricks: PlayMinigame = async (stage, pet) => Math.round((await MINIGAMES.tricks(stage, pet)) * 18);

export const PLAY_MINIGAMES: Record<string, PlayMinigame> = {
  bubbles,
  cups,
  catch: catchGame,
  memory,
  runner,
  tricks,
};
