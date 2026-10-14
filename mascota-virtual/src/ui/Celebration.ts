/**
 * Celebraciones de hitos (Auditoría P7): crecer, nacer una cría, cumpleaños...
 * En vez de un aviso de 2 segundos, una tarjeta con la mascota, confeti, lo que se desbloquea
 * y sonido. El recuerdo ya queda en el álbum (lo guarda el sistema correspondiente).
 */
import { DataRegistry } from '../data/DataRegistry';
import type { Pet } from '../systems/pet/Pet';
import type { GrowthStage } from '../systems/pet/PetTypes';
import { petSVG } from './common';
import { esc } from './dom';
import { feedback } from './Feedback';
import { showModal } from './Overlay';

/** Nombre amigable de cada función que se desbloquea por etapa. */
const FEATURE_NAMES: Record<string, string> = {
  feed: '🍖 Comer',
  pet: '✋ Caricias',
  bathe: '🫧 Baños',
  play: '⚽ Jugar',
  train: '🎯 Entrenar trucos',
  walk: '🦮 Salir de paseo',
  park: '🌳 Ir al parque',
  compete: '🏆 Competir',
  breed: '🐣 Tener crías',
};

const CONFETTI = ['🎉', '✨', '🎊', '⭐', '💛', '🐾'];

function confetti(): string {
  return `<div class="confetti" aria-hidden="true">${Array.from({ length: 18 }, (_, i) =>
    `<span style="left:${(i * 37) % 100}%;animation-delay:${(i % 6) * 0.12}s">${CONFETTI[i % CONFETTI.length]}</span>`).join('')}</div>`;
}

export function celebrate(opts: { pet: Pet; title: string; text: string; extra?: string }): void {
  feedback('level', 'success');
  showModal({
    title: opts.title,
    className: 'celebration',
    body: `${confetti()}
      <div class="celebration-pet">${petSVG(opts.pet)}</div>
      <p class="center">${opts.text}</p>
      ${opts.extra ?? ''}
      <p class="hint center">📸 Guardado en el álbum</p>`,
    buttons: [{ label: '¡Genial!', act: 'close', primary: true }],
  });
}

/** Tarjeta de cambio de etapa con lo que se desbloquea. */
export function celebrateStage(pet: Pet, from: GrowthStage, to: GrowthStage): void {
  const reg = DataRegistry.instance;
  const antes = new Set(reg.getStage(from).unlocks);
  const nuevas = reg.getStage(to).unlocks.filter((f) => !antes.has(f)).map((f) => FEATURE_NAMES[f] ?? f);
  const def = reg.getStage(to);
  celebrate({
    pet,
    title: `🌱 ¡${esc(pet.name)} ya es ${def.name}!`,
    text: esc(def.description),
    extra: nuevas.length ? `<div class="unlock-list"><b>Desbloqueado:</b> ${nuevas.join(' · ')}</div>` : '',
  });
}
