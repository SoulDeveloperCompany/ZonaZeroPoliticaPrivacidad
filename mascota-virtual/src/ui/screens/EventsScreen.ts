/** Competencias: lista de eventos, minijuego y resultados. */
import { formatDuration } from '../../core/Clock';
import { DataRegistry } from '../../data/DataRegistry';
import { EventSystem, type CompetitionSession, type EnterCheck } from '../../systems/competition/EventSystem';
import { OnlineService } from '../../systems/online/OnlineService';
import type { Pet } from '../../systems/pet/Pet';
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
    const pet = PetManager.instance.get(session.petId);
    const modal = showModal({
      title: `${comp.icon} Resultado`,
      className: 'result-modal',
      body: `
        <div class="result-stars">${starsHTML(r.rating)}</div>
        <p class="center"><b>${Math.round(r.score)} puntos</b></p>
        <div class="result-break">
          <span>Stats: ${Math.round(r.statScore)}</span><span>Minijuego: ${Math.round(r.minigameScore)}</span>
        </div>
        <p class="center reward">+${r.coins} 🪙 ${r.stars ? `+${r.stars} ⭐` : ''}</p>
        <h4>🌐 Ranking global</h4>
        <div class="ranking"><p class="empty-note">Cargando ranking…</p></div>`,
      buttons: [{ label: '¡Genial!', act: 'close', primary: true }],
    });
    void this.loadRanking(modal.body.querySelector('.ranking') as HTMLElement, comp.id, r.score, r.rating, pet);
  }

  /** Sube el puntaje al servidor y muestra el ranking real de jugadores. */
  private async loadRanking(box: HTMLElement, compId: string, score: number, rating: number, pet?: Pet): Promise<void> {
    const online = OnlineService.instance;
    try {
      if (pet) await online.submitScore(compId, score, rating, pet);
      const { lista, posicion, total } = await online.ranking(compId);
      if (!lista.length) {
        box.innerHTML = '<p class="empty-note">Todavía no hay puntajes de otros jugadores.</p>';
        return;
      }
      box.innerHTML =
        lista
          .slice(0, 10)
          .map((row, i) => {
            const sp = DataRegistry.instance.getSpecies(row.especie);
            const svg = renderPetSVG({ speciesId: sp.id, genes: { primaryColor: sp.primaryPalette[0], secondaryColor: sp.secondaryPalette[0], pattern: 'plain', size: 1 }, stage: GrowthStage.Adult, mood: 'happy' });
            return `<div class="rank-row ${row.yo ? 'me' : ''}"><span class="rank-pos">${i + 1}º</span><span class="rank-sprite">${svg}</span><span class="rank-name">${esc(row.mascota)}<small> · ${esc(row.apodo)}</small></span><span class="rank-score">${Math.round(row.puntaje)}</span></div>`;
          })
          .join('') + (posicion ? `<p class="hint center">Tu mejor puesto: ${posicion}º de ${total}</p>` : '');
    } catch (err) {
      box.innerHTML = `<p class="empty-note">${esc(OnlineService.describe(err))}</p>`;
    }
  }

}
