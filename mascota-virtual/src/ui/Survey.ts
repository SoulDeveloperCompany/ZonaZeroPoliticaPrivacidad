/**
 * Encuesta de apoyo (Auditoría, sección 6: primer experimento de monetización, sin cobrar nada).
 * Se pregunta UNA sola vez, cuando el jugador ya lleva al menos 7 días con su mascota,
 * si le interesaría un paquete de apoyo cosmético opcional. La respuesta va a las estadísticas
 * anónimas ('encuesta_apoyo'): si casi nadie dice que sí, no merece la pena desarrollarlo.
 */
import { GameState } from '../core/GameState';
import { Analytics } from '../systems/online/Analytics';
import { PetManager } from '../systems/pet/PetManager';
import { showModal } from './Overlay';

export function maybeAskSupportSurvey(): void {
  const st = GameState.instance.data;
  const pet = PetManager.instance.selected;
  if (st.surveyDone || !st.tutorialDone || !pet || pet.data.ageDays < 7) return;
  if (document.querySelector('.modal-backdrop')) return; // no interrumpir otra ventana
  st.surveyDone = true;
  const responder = (r: string) => Analytics.instance.track('encuesta_apoyo', r);
  showModal({
    title: '💬 ¿Nos ayudas con una pregunta?',
    body: `<p>Estamos pensando en un <b>Paquete de apoyo</b> opcional: decoración y accesorios exclusivos para quien quiera apoyar a Patitas.</p>
      <p class="hint">Todo lo demás seguirá siendo gratis y sin anuncios. Solo queremos saber si te interesaría.</p>`,
    buttons: [
      { label: 'No, gracias', act: 'no' },
      { label: 'Quizás', act: 'quizas' },
      { label: '¡Sí, me gustaría!', act: 'si', primary: true },
    ],
    onAction: (act) => {
      if (act === 'si' || act === 'quizas' || act === 'no') responder(act);
    },
  });
}
