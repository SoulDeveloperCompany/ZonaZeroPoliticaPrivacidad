/**
 * Minijuegos de "Jugar" ("ScriptableObjects"). Cada etapa desbloquea nuevos
 * juegos para que siempre haya algo nuevo que probar al crecer.
 * Las monedas que da cada juego tienen un tope diario para no romper la economía.
 */
import type { StatDeltas } from './types';
import { GrowthStage } from '../systems/pet/PetTypes';

export interface PlayGameDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  minStage: GrowthStage;
  energyCost: number;
  /** Monedas según la puntuación. */
  coins: (score: number) => number;
  /** Efecto sobre la mascota al terminar (según la puntuación). */
  effects: (score: number) => StatDeltas;
  /** Máximo de monedas por día en este juego. */
  dailyCoinCap: number;
  /** Cómo se lee la puntuación ("burbujas", "aciertos"...). */
  unit: string;
}

export const PLAY_GAMES: PlayGameDefinition[] = [
  {
    id: 'bubbles',
    name: 'Burbujas',
    icon: '🫧',
    description: 'Revienta todas las burbujas que puedas en 20 segundos.',
    minStage: GrowthStage.Baby,
    energyCost: 6,
    coins: (s) => Math.floor(s / 2),
    effects: (s) => ({ happiness: Math.min(14, 4 + s / 3) }),
    dailyCoinCap: 60,
    unit: 'burbujas',
  },
  {
    id: 'cups',
    name: 'Encuentra la pelota',
    icon: '🥤',
    description: 'Sigue la pelota con la vista mientras se mezclan los vasos.',
    minStage: GrowthStage.Baby,
    energyCost: 6,
    coins: (s) => s * 4,
    effects: (s) => ({ happiness: 3 + s * 2 }),
    dailyCoinCap: 60,
    unit: 'aciertos',
  },
  {
    id: 'catch',
    name: 'Atrapa golosinas',
    icon: '🍬',
    description: 'Mueve a tu mascota para atrapar comida. ¡Esquiva las verduras quemadas!',
    minStage: GrowthStage.Puppy,
    energyCost: 10,
    coins: (s) => Math.max(0, s),
    effects: (s) => ({ happiness: 8, hunger: -Math.min(20, Math.max(0, s)), agility: s >= 15 ? 1 : 0 }),
    dailyCoinCap: 80,
    unit: 'golosinas',
  },
  {
    id: 'memory',
    name: 'Memoria',
    icon: '🃏',
    description: 'Encuentra las parejas con el menor número de intentos.',
    minStage: GrowthStage.Puppy,
    energyCost: 8,
    coins: (s) => Math.round(s / 3),
    effects: () => ({ happiness: 10 }),
    dailyCoinCap: 80,
    unit: 'puntos',
  },
  {
    id: 'runner',
    name: 'Saltarín',
    icon: '🏃',
    description: 'Salta obstáculos sin parar. Tienes 3 vidas.',
    minStage: GrowthStage.Juvenile,
    energyCost: 12,
    coins: (s) => s * 2,
    effects: (s) => ({ happiness: 8, agility: s >= 10 ? 2 : s >= 5 ? 1 : 0 }),
    dailyCoinCap: 100,
    unit: 'saltos',
  },
  {
    id: 'tricks',
    name: 'Ensayo de trucos',
    icon: '🎪',
    description: 'Repite la secuencia de trucos. Ayuda a aprender trucos nuevos.',
    minStage: GrowthStage.Juvenile,
    energyCost: 10,
    coins: (s) => Math.round(s * 1.5),
    effects: () => ({ happiness: 8 }),
    dailyCoinCap: 100,
    unit: 'aciertos',
  },
];
