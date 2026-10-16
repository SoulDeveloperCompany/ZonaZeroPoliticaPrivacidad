import { beforeEach, describe, expect, it } from 'vitest';
import { Clock } from '../src/core/Clock';
import { EventBus } from '../src/core/EventBus';
import { GameState } from '../src/core/GameState';
import { OnlineConfig } from '../src/core/OnlineConfig';
import { seededRng, setRng } from '../src/core/random';
import { InteractionSystem } from '../src/systems/interaction/InteractionSystem';
import { PetManager } from '../src/systems/pet/PetManager';
import { PetMind } from '../src/systems/pet/PetMind';
import { GrowthStage, Species } from '../src/systems/pet/PetTypes';
import type { Pet } from '../src/systems/pet/Pet';

const HOUR = 3_600_000;
let now = 1_800_000_000_000;

function fresh(): PetMind {
  (PetMind as unknown as { _instance: PetMind | null })._instance = null;
  return PetMind.instance;
}
function grown(pet: Pet, stage = GrowthStage.Adult) {
  pet.data.stage = stage;
}

beforeEach(() => {
  now = 1_800_000_000_000;
  Clock.setNow(now);
  setRng(seededRng(7));
  EventBus.instance.clear();
  GameState.instance.reset(now);
  PetManager.instance.rebuild();
  OnlineConfig.DEFAULT_URL = '';
});

describe('PetMind — aprende de ti', () => {
  it('refuerzo: si acaricias tras una conducta, la repite más; lo ignorado se apaga', () => {
    const mind = fresh();
    const pet = PetManager.instance.createStarter(Species.Dog, 'Toby');
    Object.assign(pet.stats, { hunger: 10, happiness: 90, energy: 90, hygiene: 90, health: 100 });
    const before = mind.chance(pet, 'tilt');
    // Entrenamiento: cada vez que ladea la cabeza, la acaricias
    let learned = null;
    for (let i = 0; i < 400 && !learned; i++) {
      const b = mind.chooseBehavior(pet, now);
      if (b.id === 'tilt') learned = mind.reward(pet, now + 1000);
    }
    expect(learned?.id).toBe('tilt');
    expect(mind.learnedBehaviors(pet)).toContain('ladee la cabeza');
    for (let i = 0; i < 30; i++) {
      mind.chooseBehavior(pet, now);
      if (mind.of(pet).last?.id === 'tilt') mind.reward(pet, now + 500);
    }
    const after = mind.chance(pet, 'tilt');
    expect(after).toBeGreaterThan(before * 1.5);
    // Si dejas de premiarla, se olvida poco a poco (no de golpe)
    for (let i = 0; i < 40; i++) mind.chooseBehavior(pet, now);
    expect(mind.chance(pet, 'tilt')).toBeGreaterThan(before);
  });

  it('una caricia tarde (fuera de la ventana) no cuenta', () => {
    const mind = fresh();
    const pet = PetManager.instance.createStarter(Species.Cat, 'Mishi');
    mind.chooseBehavior(pet, now);
    const id = mind.of(pet).last!.id;
    mind.reward(pet, now + 20_000);
    expect(mind.of(pet).q[id] ?? 0).toBe(0);
  });

  it('rutina: tras varias visitas a la misma hora, sabe que vendrás', () => {
    const mind = fresh();
    const pet = PetManager.instance.createStarter(Species.Dog, 'Toby');
    const day = 24 * HOUR;
    const base = new Date(2027, 0, 10, 20, 0, 0).getTime();
    for (let d = 0; d < 6; d++) mind.onVisit(pet, base + d * day);
    expect(mind.usualHour(pet)).toBe(20);
    expect(mind.onVisit(pet, base + 6 * day).expected).toBe(true);
    expect(mind.onVisit(pet, base + 6 * day + 9 * HOUR).expected).toBe(false);
  });

  it('gustos: estables por mascota y se descubren al probar', () => {
    const mind = fresh();
    const pet = PetManager.instance.createStarter(Species.Dog, 'Toby');
    const t = mind.tasteOf(pet, 'food_meat');
    expect(mind.tasteOf(pet, 'food_meat')).toBe(t);
    expect(mind.onFed(pet, 'food_meat').discovered).toBe(true);
    expect(mind.onFed(pet, 'food_meat').discovered).toBe(false);
    expect(mind.tastes(pet)[t]).toContain('food_meat');
  });

  it('palabras: un bebé no habla; de mayor aprende lo que oye (el loro, el doble de rápido)', () => {
    const mind = fresh();
    const dog = PetManager.instance.createStarter(Species.Dog, 'Toby');
    for (let i = 0; i < 6; i++) mind.onAction(dog, 'play');
    expect(mind.knows(dog, 'pelota')).toBe(false);
    expect(mind.say(dog, 'hungry')).toMatch(/Guau|patita|🍼/);
    grown(dog);
    expect(mind.onAction(dog, 'play')).toBe('pelota');
    const parrot = PetManager.instance.createStarter(Species.Parrot, 'Kiwi');
    grown(parrot, GrowthStage.Puppy);
    mind.onAction(parrot, 'feed');
    expect(mind.onAction(parrot, 'feed')).toBe('comida');
  });

  it('habla según lo que sabe y recuerda momentos', () => {
    const mind = fresh();
    const pet = PetManager.instance.createStarter(Species.Dog, 'Toby');
    grown(pet);
    for (const a of ['feed', 'play', 'bathe', 'walk']) for (let i = 0; i < 4; i++) mind.onAction(pet, a);
    expect(mind.say(pet, 'hungry')).toMatch(/comida|tripita|Comemos/i);
    mind.remember(pet, 'cuando gané la carrera', '🏆');
    pet.data.bond = 50;
    expect(mind.say(pet, 'memory')).toMatch(/Te acuerdas/);
  });

  it('integrado: dar de comer descubre su gusto y le enseña «comida»', () => {
    const mind = fresh();
    mind.start();
    const pet = PetManager.instance.createStarter(Species.Dog, 'Toby');
    grown(pet);
    pet.stats.hunger = 80;
    for (let i = 0; i < 4; i++) {
      InteractionSystem.instance.perform(pet.id, 'feed', { itemId: 'food_basic' });
      now += 4 * HOUR;
      Clock.setNow(now);
      pet.stats.hunger = 80;
    }
    expect(mind.of(pet).tasted).toContain('food_basic');
    expect(mind.knows(pet, 'comida')).toBe(true);
  });

  it('peticiones: si tiene hambre lo pide, y si le haces caso te da las gracias', () => {
    const mind = fresh();
    mind.start();
    const pet = PetManager.instance.createStarter(Species.Dog, 'Toby');
    grown(pet);
    for (const a of ['feed', 'play', 'bathe']) for (let i = 0; i < 4; i++) mind.onAction(pet, a);
    pet.stats.hunger = 85;
    const c = mind.chatter(pet, now);
    expect(c?.need).toBe('feed');
    expect(mind.chatter(pet, now + 1000)).toBeNull(); // no insiste enseguida
    expect(c?.text).toMatch(/comida|tripita|Comemos/i);
    const said: string[] = [];
    EventBus.instance.on('mind:say', ({ text }) => said.push(text));
    const before = pet.stats.happiness;
    InteractionSystem.instance.perform(pet.id, 'feed', { itemId: 'food_basic' });
    expect(said.some((t) => /Gracias|mejor persona/.test(t))).toBe(true);
    expect(pet.stats.happiness).toBeGreaterThan(before);
  });

  it('diario: al cambiar de día escribe la página de ayer con lo vivido', () => {
    const mind = fresh();
    mind.start();
    const pet = PetManager.instance.createStarter(Species.Cat, 'Mishi');
    grown(pet);
    pet.stats.hunger = 80;
    InteractionSystem.instance.perform(pet.id, 'feed', { itemId: 'food_basic' });
    mind.remember(pet, 'cuando aprendí a dar vueltas', '🌀');
    expect(mind.diaryPages(pet, now)[0].today).toBe(true);
    const tomorrow = now + 26 * HOUR;
    const pages = mind.diaryPages(pet, tomorrow);
    expect(pages.length).toBe(1);
    expect(pages[0].today).toBeUndefined();
    expect(pages[0].text).toMatch(/comida básica/);
    expect(pages[0].text).toMatch(/aprendí a dar vueltas/);
  });

  it('habla según su carácter', () => {
    const mind = fresh();
    const pet = PetManager.instance.createStarter(Species.Dog, 'Toby');
    grown(pet);
    pet.data.traits = ['curioso', 'curioso'];
    for (const a of ['feed', 'play', 'bathe']) for (let i = 0; i < 4; i++) mind.onAction(pet, a);
    expect(mind.say(pet, 'trait')).toMatch(/ventana|cielo/);
  });
});
