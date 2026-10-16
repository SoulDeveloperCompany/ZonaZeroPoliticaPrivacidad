/** Calcula el bonus combinado de los muebles colocados en casa. */
import { GameState } from '../../core/GameState';
import { DataRegistry } from '../../data/DataRegistry';
import type { FurnitureBonus } from '../../data/types';

export function getFurnitureBonus(): FurnitureBonus {
  const total: Required<FurnitureBonus> = {
    sleepEnergy: 1,
    playHappiness: 1,
    bathHygiene: 1,
    happinessDecay: 1,
  };
  for (const id of GameState.instance.data.furniture) {
    if (!DataRegistry.instance.hasItem(id)) continue;
    const f = DataRegistry.instance.getItem(id).furniture ?? {};
    // Los bonus se multiplican entre sí
    (Object.keys(f) as (keyof FurnitureBonus)[]).forEach((k) => {
      total[k] *= f[k] ?? 1;
    });
  }
  return total;
}
