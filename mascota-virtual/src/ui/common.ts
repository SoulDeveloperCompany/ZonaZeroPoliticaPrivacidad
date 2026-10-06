/** Piezas de interfaz reutilizadas por varias pantallas. */
import { DataRegistry } from '../data/DataRegistry';
import { accessoryIconSVG } from '../sprites/Accessories';
import { renderPetSVG } from '../sprites/PetSprite';
import type { Pet } from '../systems/pet/Pet';
import { Sex, STAT_LABELS, type PetStatKey } from '../systems/pet/PetTypes';
import { esc } from './dom';

export interface Screen {
  id: string;
  mount(root: HTMLElement): void;
  unmount?(): void;
  /** Se llama cada segundo mientras la pantalla está visible. */
  tick?(): void;
}

export const STAT_ICONS: Record<PetStatKey, string> = {
  happiness: '❤️',
  hunger: '🍖',
  energy: '⚡',
  health: '💊',
  hygiene: '🫧',
  agility: '🏃',
  beauty: '✨',
};

export function sexIcon(sex: Sex): string {
  return sex === Sex.Female ? '<span class="sex sex-f">♀</span>' : '<span class="sex sex-m">♂</span>';
}

export function stageName(pet: Pet): string {
  return DataRegistry.instance.getStage(pet.stage).name;
}

/** Sprite de una mascota con su estado actual. */
export function petSVG(pet: Pet, className = ''): string {
  return renderPetSVG({
    speciesId: pet.data.speciesId,
    genes: pet.data.genes,
    stage: pet.stage,
    mood: pet.mood,
    sex: pet.data.sex,
    equipped: pet.data.equipped,
    className,
  });
}

/** Clave que cambia cuando el aspecto del sprite debe redibujarse. */
export function spriteKey(pet: Pet): string {
  return [pet.data.speciesId, pet.stage, pet.mood, JSON.stringify(pet.data.equipped), pet.data.genes.primaryColor].join('|');
}

/** Qué significa cada stat (se muestra al tocarlo en el panel de estado). */
export const STAT_HELP: Record<PetStatKey, string> = {
  happiness: 'Sube al jugar, acariciar, pasear y saludar en el parque. Baja con el tiempo y si la despiertas.',
  hunger: 'Cuanto más llena la barra, más hambre tiene. Dale de comer para vaciarla. Con mucha hambre pierde salud.',
  energy: 'Es su fuerza para jugar, entrenar, pasear y competir. Se gasta con esas actividades y con el tiempo. Cuando baja le entra sueño y se duerme sola para recargarla. Con muy poca energía no puede hacer actividades.',
  health: 'Baja si tiene mucha hambre, está sucia, triste o agotada. Si llega a 0 se escapa. Se cura con medicinas o cuidándola bien.',
  hygiene: 'Baja con el tiempo, al jugar y al pasear. Báñala para subirla. Si está muy sucia pierde salud.',
  agility: 'Sube al entrenar, pasear y jugar. Cuenta en la carrera de agilidad y el show de trucos.',
  beauty: 'Sube al bañarla y con accesorios. Cuenta en el concurso de belleza.',
};

/** Color continuo de la barra: verde (bien) → amarillo → rojo (mal). En hambre, llena = roja. */
export function statColor(key: PetStatKey, value: number): string {
  const good = key === 'hunger' ? 100 - value : value;
  return `hsl(${Math.round((good / 100) * 120)} 70% 50%)`;
}

/** Nivel de alerta de un stat (en hambre, alto es malo). */
export function statLevel(key: PetStatKey, value: number): 'good' | 'mid' | 'bad' {
  const v = key === 'hunger' ? 100 - value : value;
  if (v >= 60) return 'good';
  if (v >= 30) return 'mid';
  return 'bad';
}

export function statBarHTML(key: PetStatKey, value: number, extra = ''): string {
  const v = Math.round(value);
  return `
    <div class="stat" data-stat="${key}" data-act="stat-help">
      <span class="stat-icon">${STAT_ICONS[key]}</span>
      <span class="stat-label">${STAT_LABELS[key]}${extra} <span class="stat-q">?</span></span>
      <div class="bar"><div class="bar-fill ${statLevel(key, v) === 'bad' ? 'lvl-bad' : ''}" style="width:${v}%;background:${statColor(key, v)}"></div></div>
      <span class="stat-val">${v}</span>
    </div>`;
}

/** Actualiza las barras de stats ya dibujadas sin rehacer el DOM. */
export function updateStatBars(root: HTMLElement, values: Partial<Record<PetStatKey, number>>): void {
  for (const [key, value] of Object.entries(values) as [PetStatKey, number][]) {
    const row = root.querySelector<HTMLElement>(`.stat[data-stat="${key}"]`);
    if (!row) continue;
    const v = Math.round(value);
    const fill = row.querySelector<HTMLElement>('.bar-fill')!;
    fill.style.width = `${v}%`;
    fill.style.background = statColor(key, v);
    fill.className = `bar-fill ${statLevel(key, v) === 'bad' ? 'lvl-bad' : ''}`;
    row.querySelector('.stat-val')!.textContent = String(v);
  }
}

/** Icono de un item: SVG para accesorios, emoji para el resto. */
export function itemIcon(itemId: string): string {
  const svg = accessoryIconSVG(itemId);
  if (svg) return `<span class="item-icon item-icon-svg">${svg}</span>`;
  return `<span class="item-icon">${esc(DataRegistry.instance.getItem(itemId).icon)}</span>`;
}

export function starsHTML(n: number, max = 5): string {
  return `<span class="stars">${'★'.repeat(n)}<span class="stars-off">${'★'.repeat(max - n)}</span></span>`;
}
