/**
 * Acciones de cuidado. `feed` toma sus efectos del alimento elegido;
 * el resto aplica `effects` directamente. Dormir no es una acción: la mascota
 * sigue su propia rutina (ver `Pet.sleepRoutine`). Acariciar se hace tocando a la mascota.
 */
import type { ActionDefinition } from './types';
import { GrowthStage } from '../systems/pet/PetTypes';

const S = 1000;

export const ACTIONS: ActionDefinition[] = [
  {
    id: 'feed',
    name: 'Alimentar',
    icon: '🍖',
    effects: {},
    minEnergy: 0,
    cooldownMs: 20 * S,
    minStage: GrowthStage.Baby,
    animation: 'eat',
    messages: ['¡Ñam ñam!', '¡Qué rico!', '¡Delicioso!'],
  },
  {
    id: 'play',
    name: 'Jugar',
    icon: '⚽',
    effects: { happiness: 15, energy: -10, hunger: 5, hygiene: -4, agility: 1 },
    minEnergy: 15,
    cooldownMs: 45 * S,
    minStage: GrowthStage.Puppy,
    animation: 'bounce',
    messages: ['¡Otra vez, otra vez!', '¡Qué divertido!', '¡Yupi!'],
  },
  {
    id: 'pet',
    name: 'Acariciar',
    icon: '🤚',
    effects: { happiness: 6, health: 1 },
    minEnergy: 0,
    cooldownMs: 10 * S,
    minStage: GrowthStage.Baby,
    animation: 'wiggle',
    button: false,
    messages: ['♥', '¡Más mimos!', 'Purrr...'],
  },
  {
    id: 'bathe',
    name: 'Bañar',
    icon: '🫧',
    effects: { hygiene: 35, happiness: -2, beauty: 1 },
    minEnergy: 0,
    cooldownMs: 90 * S,
    minStage: GrowthStage.Baby,
    animation: 'bath',
    messages: ['¡Brillante!', 'Huele a limpio', 'Splash!'],
  },
  {
    id: 'train',
    name: 'Entrenar',
    icon: '🎯',
    effects: { energy: -15, hunger: 6, agility: 2, happiness: 3 },
    minEnergy: 20,
    cooldownMs: 60 * S,
    minStage: GrowthStage.Juvenile,
    animation: 'spin',
    messages: ['¡Casi lo tiene!', '¡Buen intento!', '¡Concentración!'],
  },
  {
    id: 'walk',
    name: 'Pasear',
    icon: '🦮',
    effects: { happiness: 12, agility: 3, energy: -15, hunger: 8, hygiene: -8 },
    minEnergy: 20,
    cooldownMs: 120 * S,
    minStage: GrowthStage.Juvenile,
    animation: 'walk',
    messages: ['¡Qué buen paseo!', '¡Mira, una mariposa!', '¡Aire fresco!'],
  },
];
