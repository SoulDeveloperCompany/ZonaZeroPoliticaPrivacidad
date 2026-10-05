/** Competencias: lista de eventos, minijuego y resultados. */
import { formatDuration } from '../../core/Clock';
import { DataRegistry } from '../../data/DataRegistry';
import { EventSystem, type CompetitionSession, type EnterCheck } from '../../systems/competition/EventSystem';
import { PetManager } from '../../systems/pet/PetManager';
import { GrowthStage } from '../../systems/pet/PetTypes';
import { renderPetSVG } from '../../sprites/PetSprite';
import { petSVG, starsHTML, type Screen } from '../common';
import { el, esc, onAction, priceHTML, setHTML } from '../dom';
import { MINIGAMES } from '../minigames/Minigames';
import { showModal, showToast } from '../Overlay';

function reasonText(c: Extract<EnterCheck, { ok: false }>): string {
  switch (c.reason) {
    case 'stage':
      return '🔒 Solo mascotas adultas';
    case 'energy':
      return '⚡ Le falta energía';
    case 'cooldown':
      return `⏳ Descansando ${formatDuration(c.remainingMs ?? 0)}`;
    case 'funds':
      return '🪙 Sin monedas para la inscripción';
    case 'sleeping':
      return '💤 Está durmiendo';
    default:
      return 'No disponible';
  }
}

export class EventsScreen implements Screen {
  id = 'events';
  private root!: HTMLElement;
  private playing = false;

  mount(root: HTMLElement): void {
    this.root = root;
    onAction(root, (act, t) => {
      if (act === 'enter') void this.enter(t.dataset.id!);
      if (act === 'select') {
        PetManager.instance.select(t.dataset.id!);
        this.render();
      }
    });
    this.render();
  }

  tick(): void {
    if (!this.playing) this.render();
  }

  render(): void {
    const pet = PetManager.instance.selected;
    const home = PetManager.instance.homePets().filter((p) => p.isActive);
    const picker = home
      .map((p) => `<button class="pet-chip ${p.id === pet?.id ? 'active' : ''}" data-act="select" data-id="${p.id}">${petSVG(p)}<span>${esc(p.name)}</span></button>`)
      .join('');
    const cards = EventSystem.instance
      .list()
      .map((comp) => {
        const check = pet ? EventSystem.instance.canEnter(pet, comp.id) : null;
        return `
          <div class="card comp">
            <div class="comp-head"><span class="comp-icon">${comp.icon}</span><div><b>${esc(comp.name)}</b><small>${esc(comp.description)}</small></div></div>
            <div class="comp-meta">Inscripción: ${priceHTML(comp.entryFee)} · ⚡ ${comp.energyCost} · Premio máx: 🪙 ${comp.rewards.coins[4]} + ⭐ ${comp.rewards.stars[4]}</div>
            <button class="btn ${check?.ok ? 'btn-primary' : ''}" data-act="enter" data-id="${comp.id}" ${check?.ok ? '' : 'disabled'}>
              ${check ? (check.ok ? '¡Participar!' : reasonText(check)) : 'Elige una mascota'}
            </button>
          </div>`;
      })
      .join('');
    setHTML(this.root, `
      <h2 class="screen-title">🏆 Competencias</h2>
      <div class="pet-chips">${picker || '<p class="hint">No hay mascotas en casa.</p>'}</div>
      <p class="hint">La nota combina los stats de tu mascota con tu habilidad en el minijuego. Calificación de 1 a 5 estrellas.</p>
      ${cards}`);
  }

  private async enter(compId: string): Promise<void> {
    const pet = PetManager.instance.selected;
    if (!pet || this.playing) return;
    const session = EventSystem.instance.start(pet.id, compId);
    if (!('competitionId' in session)) {
      if (!session.ok) showToast(reasonText(session), 'bad');
      return;
    }
    this.playing = true;
    const comp = DataRegistry.instance.getCompetition(compId);
    const overlay = el('div', 'minigame');
    overlay.innerHTML = `<div class="mg-title">${comp.icon} ${esc(comp.name)}</div><div class="mg-stage"></div>`;
    document.body.appendChild(overlay);
    try {
      const performance = await MINIGAMES[comp.minigame](overlay.querySelector('.mg-stage') as HTMLElement, pet);
      overlay.remove();
      this.showResult(session as CompetitionSession, performance);
    } catch (err) {
      overlay.remove();
      console.error(err);
    } finally {
      this.playing = false;
      this.render();
    }
  }

  private showResult(session: CompetitionSession, performance: number): void {
    const r = EventSystem.instance.finish(session, performance);
    const comp = DataRegistry.instance.getCompetition(session.competitionId);
    const ranking = r.ranking
      .map((rv, i) => {
        const sprite = renderPetSVG({
          speciesId: rv.speciesId,
          genes: (() => {
            const sp = DataRegistry.instance.getSpecies(rv.speciesId);
            return { primaryColor: sp.primaryPalette[i % sp.primaryPalette.length], secondaryColor: sp.secondaryPalette[0], pattern: 'plain' as const, size: 1 };
          })(),
          stage: GrowthStage.Adult,
          mood: rv.isPlayer ? 'happy' : 'normal',
        });
        const playerPet = PetManager.instance.get(session.petId);
        const svg = rv.isPlayer && playerPet ? petSVG(playerPet) : sprite;
        return `<div class="rank-row ${rv.isPlayer ? 'me' : ''}"><span class="rank-pos">${i + 1}º</span><span class="rank-sprite">${svg}</span><span class="rank-name">${esc(rv.name)}</span><span class="rank-score">${Math.round(rv.score)}</span></div>`;
      })
      .join('');
    showModal({
      title: `${comp.icon} Resultado`,
      className: 'result-modal',
      body: `
        <div class="result-stars">${starsHTML(r.rating)}</div>
        <p class="center"><b>${Math.round(r.score)} puntos</b> · ${r.position}º puesto</p>
        <div class="result-break">
          <span>Stats: ${Math.round(r.statScore)}</span><span>Minijuego: ${Math.round(r.minigameScore)}</span>
        </div>
        <p class="center reward">+${r.coins} 🪙 ${r.stars ? `+${r.stars} ⭐` : ''}</p>
        <div class="ranking">${ranking}</div>`,
      buttons: [{ label: '¡Genial!', act: 'close', primary: true }],
    });
  }
}
