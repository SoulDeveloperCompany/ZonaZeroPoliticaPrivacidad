/**
 * Página de herramienta: muestra todos los sprites (especies × etapas ×
 * estados de ánimo × accesorios) para revisarlos de un vistazo.
 * Abrir en desarrollo: http://localhost:5173/sprites.html
 */
import { DataRegistry } from './data/DataRegistry';
import { renderPetSVG } from './sprites/PetSprite';
import { GrowthStage, STAGE_ORDER, Sex } from './systems/pet/PetTypes';
import type { PetMood } from './systems/pet/Pet';

const root = document.getElementById('gallery')!;
const moods: PetMood[] = ['normal', 'happy', 'sad', 'hungry', 'dirty', 'sick', 'tired', 'sleeping'];
const outfits = [
  {},
  { head: 'acc_bow', neck: 'acc_bell' },
  { head: 'acc_tophat', face: 'acc_monocle', neck: 'acc_bowtie' },
  { head: 'acc_crown', face: 'acc_glasses', neck: 'acc_scarf' },
  { head: 'acc_cap' },
  { head: 'acc_flower' },
];

let html = '';
for (const sp of DataRegistry.instance.allSpecies()) {
  const genes = { primaryColor: sp.primaryPalette[0], secondaryColor: sp.secondaryPalette[0], pattern: 'plain' as const, size: 1 };
  html += `<h2>${sp.icon} ${sp.name}</h2><div class="row">`;
  for (const stage of STAGE_ORDER) {
    html += `<div class="cell">${renderPetSVG({ speciesId: sp.id, genes, stage })}${stage}</div>`;
  }
  for (const mood of moods) {
    html += `<div class="cell">${renderPetSVG({ speciesId: sp.id, genes, stage: GrowthStage.Adult, mood, sex: Sex.Female })}${mood}</div>`;
  }
  sp.patterns.forEach((pattern, i) => {
    const g = { primaryColor: sp.primaryPalette[(i + 1) % sp.primaryPalette.length], secondaryColor: sp.secondaryPalette[(i + 1) % sp.secondaryPalette.length], pattern, size: 1 };
    html += `<div class="cell">${renderPetSVG({ speciesId: sp.id, genes: g, stage: GrowthStage.Adult })}${pattern}</div>`;
  });
  outfits.forEach((equipped, i) => {
    html += `<div class="cell">${renderPetSVG({ speciesId: sp.id, genes, stage: i % 2 ? GrowthStage.Adult : GrowthStage.Puppy, equipped, mood: 'happy' })}outfit ${i}</div>`;
  });
  html += '</div>';
}
root.innerHTML = html;
