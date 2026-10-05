/**
 * Etapas de crecimiento. Cada etapa define qué funciones desbloquea.
 * La lista `unlocks` es completa (no acumulativa) para poder quitar
 * cosas en etapas posteriores (p. ej. el Senior ya no se aparea).
 */
import type { StageDefinition } from './types';
import { GrowthStage } from '../systems/pet/PetTypes';

/** Identificadores de funciones desbloqueables. */
export const Feature = {
  Feed: 'feed',
  Pet: 'pet',
  Bathe: 'bathe',
  Play: 'play',
  Train: 'train',
  Walk: 'walk',
  Park: 'park',
  Compete: 'compete',
  Breed: 'breed',
} as const;

const BASIC = [Feature.Feed, Feature.Pet, Feature.Bathe];

export const STAGES: StageDefinition[] = [
  {
    id: GrowthStage.Baby,
    name: 'Bebé',
    startDay: 0,
    scale: 0.62,
    statCap: 30,
    unlocks: [...BASIC],
    description: 'Necesita comida, mimos, baños y mucho sueño.',
  },
  {
    id: GrowthStage.Puppy,
    name: 'Cachorro',
    startDay: 3,
    scale: 0.75,
    statCap: 50,
    unlocks: [...BASIC, Feature.Play],
    description: '¡Ya puede jugar!',
  },
  {
    id: GrowthStage.Juvenile,
    name: 'Juvenil',
    startDay: 7,
    scale: 0.88,
    statCap: 75,
    unlocks: [...BASIC, Feature.Play, Feature.Train, Feature.Walk, Feature.Park],
    description: 'Aprende trucos, sale de paseo y visita el parque.',
  },
  {
    id: GrowthStage.Adult,
    name: 'Adulto',
    startDay: 14,
    scale: 1,
    statCap: 100,
    unlocks: [
      ...BASIC,
      Feature.Play,
      Feature.Train,
      Feature.Walk,
      Feature.Park,
      Feature.Compete,
      Feature.Breed,
    ],
    description: 'Puede competir en eventos y tener crías.',
  },
  {
    id: GrowthStage.Senior,
    name: 'Senior',
    startDay: 45,
    scale: 1,
    statCap: 90,
    unlocks: [...BASIC, Feature.Play, Feature.Train, Feature.Walk, Feature.Park, Feature.Compete],
    description: 'Sabio y tranquilo. Sigue compitiendo, pero ya no tiene crías.',
  },
];
