/**
 * Diario de la mascota (PetMind): una página por día, escrita en primera persona.
 * Si el servidor tiene activado el diario con IA, la página del día anterior se reescribe con Claude
 * (solo con datos del juego) y se puede denunciar desde aquí (exigencia de Google Play).
 */
import { EventBus } from '../core/EventBus';
import { OnlineService } from '../systems/online/OnlineService';
import { PetManager } from '../systems/pet/PetManager';
import { PetMind, type DayLog } from '../systems/pet/PetMind';
import type { Pet } from '../systems/pet/Pet';
import { esc } from './dom';
import { showModal, showToast } from './Overlay';

const fecha = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
};

export function openDiary(pet: Pet): void {
  const pages = PetMind.instance.diaryPages(pet);
  const body = pages.length
    ? pages
        .map(
          (p, i) => `<div class="diary-page"><b>${p.today ? 'Hoy (hasta ahora)' : esc(fecha(p.day))}${p.ai ? ' <span class="ai-tag">· escrito con IA</span>' : ''}</b>${esc(p.text)}
          ${p.ai ? `<button class="diary-report" data-act="report" data-i="${i}">🚩 Denunciar esta página</button>` : ''}</div>`,
        )
        .join('')
    : `<p class="center hint">Todavía no hay páginas. Cuida a ${esc(pet.name)} hoy y mañana leerás lo que vivieron juntos.</p>`;
  showModal({
    title: `📔 Diario de ${esc(pet.name)}`,
    className: 'diary-modal',
    body,
    onAction: (act, t) => {
      if (act !== 'report') return;
      const page = pages[Number(t.dataset.i)];
      void OnlineService.instance
        .reportDiary(page.day, page.text, 'inapropiado')
        .then(() => showToast('Gracias. Revisaremos esta página.', 'good'))
        .catch(() => showToast('No se pudo enviar ahora. Inténtalo más tarde.', 'bad'));
      t.remove();
      return true;
    },
  });
}

/** Cuando se cierra un día, intenta que la IA del servidor reescriba esa página (si está activada). */
export function setupDiaryAI(): void {
  EventBus.instance.on('mind:diary', ({ petId, day, log }) => {
    const pet = PetManager.instance.get(petId);
    if (!pet || !OnlineService.instance.isConfigured()) return;
    void requestPage(pet, day, log);
  });
}

async function requestPage(pet: Pet, day: string, log: DayLog): Promise<void> {
  const mind = PetMind.instance;
  try {
    const texto = await OnlineService.instance.diaryAI({
      nombre: pet.name,
      especie: pet.data.speciesId,
      etapa: pet.stage,
      sexo: pet.data.sex,
      rasgos: pet.data.traits,
      vinculo: Math.round(pet.data.bond),
      registro: { acciones: log.actions, comidas: log.foods, juegos: log.games, novedades: log.news },
      leGusta: mind.summary(pet).tastes.love,
    });
    if (texto) mind.setDiaryText(pet, day, texto);
  } catch {
    /* sin servidor o sin IA: se queda la página escrita en el móvil */
  }
}
