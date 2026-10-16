/**
 * Pantalla de "Jugar": lista de minijuegos (bloqueados según la etapa),
 * récords, partida y resultado. Y la ventana de misiones diarias.
 */
import { DataRegistry } from '../data/DataRegistry';
import { MISSION_BONUS } from '../data/missions';
import { GamesSystem } from '../systems/games/GamesSystem';
import { MissionSystem } from '../systems/games/MissionSystem';
import type { Pet } from '../systems/pet/Pet';
import type { PetStatKey } from '../systems/pet/PetTypes';
import { STAT_ICONS, petSVG } from './common';
import { el, esc } from './dom';
import { PLAY_MINIGAMES } from './minigames/PlayGames';
import { confetti } from './Celebration';
import { feedback } from './Feedback';
import { Analytics } from '../systems/online/Analytics';
import { showModal, showToast } from './Overlay';

const REASON: Record<string, string> = {
  energy: '⚡ Le falta energía',
  sleeping: '💤 Está durmiendo',
  stage: '🔒 Bloqueado',
  notHome: 'No está en casa',
};

export function openGames(pet: Pet): void {
  const gs = GamesSystem.instance;
  const render = () =>
    `<div class="games-grid">${gs
      .list()
      .map((g) => {
        const unlocked = gs.isUnlocked(pet, g);
        const check = gs.canPlay(pet, g.id);
        const stage = DataRegistry.instance.getStage(g.minStage).name;
        const cap = gs.coinsToday(g.id) >= g.dailyCoinCap;
        return `<button class="game-card ${unlocked ? '' : 'locked'}" data-act="play" data-id="${g.id}">
          <span class="game-icon">${unlocked ? g.icon : '🔒'}</span>
          <b>${esc(g.name)}</b>
          <small>${unlocked ? esc(g.description) : `Se desbloquea en ${stage}`}</small>
          <span class="game-meta">${unlocked ? `⚡${g.energyCost} · 🏆 ${gs.record(g.id)}${cap ? ' · 🪙 tope de hoy' : ''}` : stage}</span>
          ${unlocked && !check.ok ? `<span class="game-warn">${REASON[check.reason]}</span>` : ''}
        </button>`;
      })
      .join('')}</div>`;
  showModal({
    title: `🎮 Jugar con ${esc(pet.name)}`,
    className: 'games-modal',
    body: render(),
    buttons: [{ label: 'Cerrar', act: 'close' }],
    onAction: (act, t, modal) => {
      if (act !== 'play') return;
      const id = t.dataset.id!;
      const check = gs.canPlay(pet, id);
      if (!check.ok) {
        const stage = DataRegistry.instance.getStage(gs.get(id).minStage).name;
        showToast(check.reason === 'stage' ? `Se desbloquea cuando sea ${stage}` : REASON[check.reason], 'bad');
        return true;
      }
      modal.close();
      void runGame(pet, id);
      return true;
    },
  });
}

async function runGame(pet: Pet, gameId: string): Promise<void> {
  const game = GamesSystem.instance.get(gameId);
  const overlay = el('div', 'minigame');
  overlay.innerHTML = `<div class="mg-top"><div class="mg-title">${game.icon} ${esc(game.name)}</div><button class="btn btn-sm" data-exit>✕ Salir</button></div><div class="mg-stage"></div>`;
  document.body.appendChild(overlay);
  let quit = false;
  const quitP = new Promise<null>((res) =>
    overlay.querySelector('[data-exit]')!.addEventListener('click', () => {
      quit = true;
      res(null);
    }),
  );
  const score = await Promise.race([PLAY_MINIGAMES[gameId](overlay.querySelector('.mg-stage') as HTMLElement, pet), quitP]);
  overlay.remove();
  if (quit || score === null) return;
  const prevRecord = GamesSystem.instance.record(gameId);
  const r = GamesSystem.instance.finish(pet.id, gameId, score);
  const effects = (Object.entries(r.deltas) as [PetStatKey, number][])
    .filter(([, v]) => Math.abs(v) >= 1)
    .map(([k, v]) => `${v > 0 ? '+' : ''}${Math.round(v)} ${STAT_ICONS[k]}`)
    .join(' · ');
  // Valoración respecto a tu récord anterior (el primer intento siempre es "¡Muy bien!")
  const ratio = prevRecord > 0 ? r.score / prevRecord : r.score > 0 ? 0.8 : 0;
  const verdict = r.score === 0 ? '¡Buen intento!' : r.record && prevRecord > 0 ? '¡Nuevo récord!' : ratio >= 0.75 ? '¡Muy bien!' : ratio >= 0.4 ? '¡Bien jugado!' : '¡Buen intento!';
  feedback(r.record ? 'level' : 'coin', r.record ? 'success' : 'light');
  const modal = showModal({
    title: `${game.icon} ${esc(game.name)}`,
    className: r.record && prevRecord > 0 ? 'celebration game-result' : 'game-result',
    body: `${r.record && prevRecord > 0 ? confetti() : ''}
      <div class="result-pet">${petSVG(pet, '', 'happy')}</div>
      <div class="result-verdict ${r.record && prevRecord > 0 ? 'record' : ''}">${verdict}</div>
      <p class="result-score"><b data-count="${r.score}">0</b> <span>${esc(game.unit)}</span></p>
      <p class="hint center">${r.record && prevRecord > 0 ? `Antes: ${prevRecord}` : `Récord: ${GamesSystem.instance.record(gameId)}`}</p>
      <p class="center reward">+${r.coins} 🪙</p>
      ${r.capped ? '<p class="hint center">Ya llegaste al tope de monedas de hoy en este juego. ¡Prueba otro!</p>' : ''}
      <p class="center">${effects}</p>`,
    buttons: [
      { label: 'Salir', act: 'close' },
      { label: '🔁 Otra vez', act: 'again', primary: true },
    ],
    onAction: (act) => {
      if (act !== 'again') return;
      Analytics.instance.track('juego_otra_vez', gameId);
      const check = GamesSystem.instance.canPlay(pet, gameId);
      if (check.ok) void runGame(pet, gameId);
      else showToast(REASON[check.reason], 'bad');
    },
  });
  // La puntuación cuenta hacia arriba (más satisfactorio que aparecer de golpe)
  const num = modal.body.querySelector<HTMLElement>('[data-count]');
  if (num) {
    const target = r.score;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 700);
      num.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1 && num.isConnected) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

/** Ventana de misiones diarias. */
export function openMissions(onChange: () => void): void {
  const ms = MissionSystem.instance;
  const render = () => {
    const list = ms.today();
    const allDone = list.every((x) => x.state.claimed);
    return `<p class="hint center">Se renuevan cada día a medianoche.</p>
      <div class="missions">${list
        .map(({ def, state }) => {
          const done = state.progress >= def.goal;
          const pct = Math.min(100, Math.round((state.progress / def.goal) * 100));
          return `<div class="mission ${state.claimed ? 'claimed' : ''}">
            <div class="mission-text"><b>${esc(def.text)}</b><small>${Math.min(state.progress, def.goal)} / ${def.goal} · 🪙 ${def.reward}</small>
              <div class="bar"><div class="bar-fill" style="width:${pct}%;background:${done ? 'var(--good)' : 'var(--accent)'}"></div></div></div>
            ${state.claimed ? '<span class="mission-ok">✔</span>' : `<button class="btn btn-sm ${done ? 'btn-primary' : ''}" data-act="claim" data-id="${def.id}" ${done ? '' : 'disabled'}>Cobrar</button>`}
          </div>`;
        })
        .join('')}</div>
      <div class="mission-bonus ${ms.bonusAvailable() ? 'ready' : ''}">
        🎁 Completa las 3: +${MISSION_BONUS.coins} 🪙 +${MISSION_BONUS.stars} ⭐
        ${ms.bonusAvailable() ? '<button class="btn btn-sm btn-primary" data-act="bonus">Cobrar</button>' : allDone ? '<span class="mission-ok">✔</span>' : ''}
      </div>`;
  };
  showModal({
    title: '📋 Misiones de hoy',
    body: render(),
    buttons: [{ label: 'Cerrar', act: 'close', primary: true }],
    onAction: (act, t, modal) => {
      if (act === 'claim') {
        const coins = ms.claim(t.dataset.id!);
        if (coins) showToast(`+${coins} 🪙`, 'good');
      } else if (act === 'bonus' && ms.claimBonus()) {
        showToast(`¡Misiones completadas! +${MISSION_BONUS.coins} 🪙 +${MISSION_BONUS.stars} ⭐`, 'good');
      } else return;
      modal.body.innerHTML = render();
      onChange();
      return true;
    },
  });
}
