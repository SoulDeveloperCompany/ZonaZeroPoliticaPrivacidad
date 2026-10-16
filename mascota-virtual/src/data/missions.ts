/**
 * Misiones diarias: cada día se eligen 3 según la etapa de la mascota.
 * `event` es lo que hay que hacer: una acción de cuidado, un minijuego, etc.
 */
import { GrowthStage } from '../systems/pet/PetTypes';

export interface MissionDefinition {
  id: string;
  text: string;
  goal: number;
  /** action:<id> · game · game:<id>:<puntuación mínima> · competition · purchase · greet */
  event: string;
  reward: number;
  minStage: GrowthStage;
}

export const MISSIONS: MissionDefinition[] = [
  { id: 'feed3', text: 'Alimenta 3 veces', goal: 3, event: 'action:feed', reward: 30, minStage: GrowthStage.Baby },
  { id: 'pet5', text: 'Acaricia 5 veces', goal: 5, event: 'action:pet', reward: 20, minStage: GrowthStage.Baby },
  { id: 'bathe1', text: 'Dale un baño', goal: 1, event: 'action:bathe', reward: 25, minStage: GrowthStage.Baby },
  { id: 'play2', text: 'Juega 2 minijuegos', goal: 2, event: 'game', reward: 35, minStage: GrowthStage.Baby },
  { id: 'bubbles20', text: 'Revienta 20 burbujas en una partida', goal: 1, event: 'game:bubbles:20', reward: 40, minStage: GrowthStage.Baby },
  { id: 'cups4', text: 'Acierta 4 vasos en una partida', goal: 1, event: 'game:cups:4', reward: 40, minStage: GrowthStage.Baby },
  { id: 'catch15', text: 'Atrapa 15 golosinas en una partida', goal: 1, event: 'game:catch:15', reward: 45, minStage: GrowthStage.Puppy },
  { id: 'memory1', text: 'Completa una partida de Memoria', goal: 1, event: 'game:memory:1', reward: 35, minStage: GrowthStage.Puppy },
  { id: 'walk1', text: 'Sal de paseo', goal: 1, event: 'action:walk', reward: 30, minStage: GrowthStage.Juvenile },
  { id: 'train2', text: 'Entrena 2 veces', goal: 2, event: 'action:train', reward: 35, minStage: GrowthStage.Juvenile },
  { id: 'runner10', text: 'Haz 10 saltos en Saltarín', goal: 1, event: 'game:runner:10', reward: 45, minStage: GrowthStage.Juvenile },
  { id: 'compete1', text: 'Participa en una competencia', goal: 1, event: 'competition', reward: 50, minStage: GrowthStage.Adult },
  { id: 'shop1', text: 'Compra algo en la tienda', goal: 1, event: 'purchase', reward: 20, minStage: GrowthStage.Baby },
];

/** Premio por completar las 3 misiones del día. */
export const MISSION_BONUS = { coins: 40, stars: 1 };
