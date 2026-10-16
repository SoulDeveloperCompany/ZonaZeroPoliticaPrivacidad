/**
 * Competencias disponibles ("ScriptableObjects").
 * La nota final (0-100) = stats ponderados + minijuego ponderado.
 */
import type { CompetitionDefinition } from './types';

const MIN = 60 * 1000;

export const COMPETITIONS: CompetitionDefinition[] = [
  {
    id: 'agility_race',
    name: 'Carrera de agilidad',
    description: 'Salta los obstáculos tocando la pantalla en el momento justo.',
    icon: '🏃',
    minigame: 'agility',
    statWeights: { agility: 0.45, energy: 0.1, happiness: 0.05 },
    minigameWeight: 0.4,
    energyCost: 25,
    entryFee: { coins: 20 },
    cooldownMs: 20 * MIN,
    ratingThresholds: [35, 50, 65, 80],
    rewards: { coins: [10, 30, 55, 90, 150], stars: [0, 0, 1, 2, 4] },
  },
  {
    id: 'beauty_contest',
    name: 'Concurso de belleza',
    description: 'Posa en la pasarela: toca cuando el indicador esté en la zona dorada.',
    icon: '💅',
    minigame: 'beauty',
    statWeights: { beauty: 0.45, hygiene: 0.1, happiness: 0.05 },
    minigameWeight: 0.4,
    energyCost: 15,
    entryFee: { coins: 20 },
    cooldownMs: 20 * MIN,
    ratingThresholds: [35, 50, 65, 80],
    rewards: { coins: [10, 30, 55, 90, 150], stars: [0, 0, 1, 2, 4] },
  },
  {
    id: 'trick_show',
    name: 'Show de trucos',
    description: 'Repite la secuencia de trucos sin equivocarte.',
    icon: '🎪',
    minigame: 'tricks',
    statWeights: { tricks: 0.3, agility: 0.15, happiness: 0.1 },
    minigameWeight: 0.45,
    energyCost: 20,
    entryFee: { coins: 25 },
    cooldownMs: 20 * MIN,
    ratingThresholds: [35, 50, 65, 80],
    rewards: { coins: [12, 35, 60, 100, 170], stars: [0, 0, 1, 2, 5] },
  },
];
