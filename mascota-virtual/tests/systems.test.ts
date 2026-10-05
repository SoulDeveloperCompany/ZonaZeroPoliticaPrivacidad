import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Clock } from '../src/core/Clock';
import { GameManager } from '../src/core/GameManager';
import { GamesSystem } from '../src/systems/games/GamesSystem';
import { MissionSystem } from '../src/systems/games/MissionSystem';
import { OnlineService } from '../src/systems/online/OnlineService';
import { EventBus } from '../src/core/EventBus';
import { GameConfig } from '../src/core/GameConfig';
import { GameState } from '../src/core/GameState';
import { seededRng, setRng } from '../src/core/random';
import { BreedingSystem } from '../src/systems/breeding/BreedingSystem';
import { EventSystem, type CompetitionSession } from '../src/systems/competition/EventSystem';
import { EconomySystem } from '../src/systems/economy/EconomySystem';
import { GrowthSystem } from '../src/systems/growth/GrowthSystem';
import { InteractionSystem } from '../src/systems/interaction/InteractionSystem';
import { Pet } from '../src/systems/pet/Pet';
import { PetManager } from '../src/systems/pet/PetManager';
import { GrowthStage, PetLocation, Sex, Species } from '../src/systems/pet/PetTypes';
import { SaveSystem } from '../src/systems/save/SaveSystem';
import { MemoryStorage } from '../src/systems/save/Storage';

const HOUR = 60 * 60 * 1000;
let now = 1_800_000_000_000;

function advance(ms: number, offline = false) {
  now += ms;
  Clock.setNow(now);
  PetManager.instance.update(ms, offline);
}

/** Mantiene a la mascota perfectamente cuidada. */
function pamper(pet: Pet) {
  Object.assign(pet.stats, { hunger: 10, happiness: 95, energy: 90, health: 100, hygiene: 95 });
}

beforeEach(() => {
  now = 1_800_000_000_000;
  Clock.setNow(now);
  setRng(seededRng(42));
  EventBus.instance.clear();
  GameState.instance.reset(now);
  PetManager.instance.rebuild();
  SaveSystem.instance.storage = new MemoryStorage();
});

describe('PetSystem', () => {
  it('crea un bebé con stats válidos y sexo aleatorio', () => {
    const pet = PetManager.instance.createStarter(Species.Dog, 'Toby');
    expect(pet.stage).toBe(GrowthStage.Baby);
    expect([Sex.Male, Sex.Female]).toContain(pet.data.sex);
    for (const v of Object.values(pet.stats)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('los stats se degradan con el tiempo (hambre sube, felicidad baja)', () => {
    const pet = PetManager.instance.createStarter(Species.Cat, 'Michi');
    const before = { ...pet.stats };
    advance(HOUR / 2);
    expect(pet.stats.hunger).toBeGreaterThan(before.hunger);
    expect(pet.stats.happiness).toBeLessThan(before.happiness);
    expect(pet.stats.hygiene).toBeLessThan(before.hygiene);
  });

  it('nunca muere: con salud 0 se escapa y hay 48 h para recuperarla', () => {
    const pet = PetManager.instance.createStarter(Species.Rabbit, 'Copito');
    pet.stats.health = 1;
    pet.stats.hunger = 100;
    advance(HOUR);
    expect(pet.data.location).toBe(PetLocation.Escaped);
    expect(PetManager.instance.escapeTimeLeft(pet)).toBeGreaterThan(47 * HOUR);

    // El Collar GPS la recupera al instante
    EconomySystem.instance.addItem('special_gps');
    const res = EconomySystem.instance.useItem(pet.id, 'special_gps');
    expect(res.ok).toBe(true);
    expect(pet.isActive).toBe(true);
    expect(pet.stats.health).toBeGreaterThan(0);
  });

  it('si pasan 48 h sin encontrarla se va con otra familia (queda en el álbum)', () => {
    const pet = PetManager.instance.createStarter(Species.Turtle, 'Tuga');
    pet.stats.health = 0.5;
    pet.stats.hunger = 100;
    advance(HOUR);
    expect(pet.isEscaped).toBe(true);
    advance(49 * HOUR, true);
    expect(PetManager.instance.get(pet.id)).toBeUndefined();
    expect(GameState.instance.data.album.some((m) => m.kind === 'farewell')).toBe(true);
  });

  it('respeta el límite de 3 mascotas en casa; el resto va al rancho', () => {
    for (let i = 0; i < 4; i++) {
      PetManager.instance.add(Pet.create({ name: `P${i}`, speciesId: Species.Hamster, now }), 'adopted');
    }
    expect(PetManager.instance.homePets()).toHaveLength(3);
    expect(PetManager.instance.byLocation(PetLocation.Ranch)).toHaveLength(1);
  });
});

describe('GrowthSystem', () => {
  it('1 hora real = 1 día de juego y avanza por las etapas', () => {
    const pet = PetManager.instance.createStarter(Species.Dog, 'Rex');
    const stages: GrowthStage[] = [];
    for (let h = 0; h < 50; h++) {
      pamper(pet);
      advance(HOUR);
      stages.push(pet.stage);
    }
    expect(pet.data.ageDays).toBeCloseTo(50, 0);
    expect(stages).toContain(GrowthStage.Puppy);
    expect(stages).toContain(GrowthStage.Juvenile);
    expect(stages).toContain(GrowthStage.Adult);
    expect(pet.stage).toBe(GrowthStage.Senior);
  });

  it('el buen cuidado temprano da +10% a los stats base del adulto', () => {
    const cared = PetManager.instance.createStarter(Species.Dog, 'Bien');
    const baseAgility = cared.data.genes.baseAgility;
    for (let h = 0; h < 15; h++) {
      pamper(cared);
      advance(HOUR);
    }
    expect(cared.stage).toBe(GrowthStage.Adult);
    expect(cared.data.wellCared).toBe(true);
    expect(cared.data.genes.baseAgility).toBe(Math.round(baseAgility * 1.1));
  });

  it('la barra de progreso va de 0 a 1 entre etapas', () => {
    const pet = PetManager.instance.createStarter(Species.Cat, 'Mia');
    pet.data.ageDays = 1.5;
    const p = GrowthSystem.instance.progress(pet);
    expect(p.progress).toBeCloseTo(0.5);
    expect(p.next?.id).toBe(GrowthStage.Puppy);
  });

  it('los aceleradores suman días', () => {
    const pet = PetManager.instance.createStarter(Species.Parrot, 'Kiwi');
    EconomySystem.instance.addItem('acc_growth_vitamin', 3);
    for (let i = 0; i < 3; i++) EconomySystem.instance.useItem(pet.id, 'acc_growth_vitamin');
    expect(pet.stage).toBe(GrowthStage.Puppy);
  });
});

describe('InteractionSystem', () => {
  it('alimentar baja el hambre y aplica cooldown', () => {
    const pet = PetManager.instance.createStarter(Species.Dog, 'Max');
    pet.stats.hunger = 70;
    const r = InteractionSystem.instance.perform(pet.id, 'feed');
    expect(r.ok).toBe(true);
    expect(pet.stats.hunger).toBeLessThan(70);
    const again = InteractionSystem.instance.perform(pet.id, 'feed');
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe('cooldown');
  });

  it('las acciones se desbloquean por etapa', () => {
    const pet = PetManager.instance.createStarter(Species.Dog, 'Max');
    const r = InteractionSystem.instance.perform(pet.id, 'walk');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('locked');
  });

  it('entrenar enseña trucos', () => {
    const pet = PetManager.instance.createStarter(Species.Parrot, 'Paco');
    GrowthSystem.instance.addDays(pet, 8);
    for (let i = 0; i < 6; i++) {
      pamper(pet);
      now += 2 * 60 * 1000;
      Clock.setNow(now);
      InteractionSystem.instance.perform(pet.id, 'train');
    }
    expect(pet.data.tricks.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Rutina de sueño', () => {
  it('se duerme sola con poca energía y se despierta sola al descansar', () => {
    const pet = PetManager.instance.createStarter(Species.Dog, 'Dormilón');
    pamper(pet);
    pet.stats.energy = 21;
    advance(10 * 60 * 1000); // la energía baja de 20
    expect(pet.data.sleeping).toBe(true);
    for (let i = 0; i < 4 && pet.data.sleeping; i++) advance(HOUR / 2);
    expect(pet.data.sleeping).toBe(false);
  });

  it('despertarla al tocarla quita felicidad y aguanta despierta un rato', () => {
    const pet = PetManager.instance.createStarter(Species.Cat, 'Siesta');
    pamper(pet);
    pet.stats.energy = 15;
    pet.data.sleeping = true;
    const happiness = pet.stats.happiness;
    expect(InteractionSystem.instance.wakeUp(pet.id)).toBe(true);
    expect(pet.data.sleeping).toBe(false);
    expect(pet.stats.happiness).toBe(happiness - GameConfig.SLEEP.wakePenalty);
    advance(60 * 1000);
    expect(pet.data.sleeping).toBe(false); // periodo de gracia
  });

  it('mientras duerme no se pueden hacer acciones', () => {
    const pet = PetManager.instance.createStarter(Species.Dog, 'Zzz');
    pet.data.sleeping = true;
    pet.stats.hunger = 70;
    const r = InteractionSystem.instance.perform(pet.id, 'feed');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('sleeping');
  });

  it('se puede cambiar el nombre', () => {
    const pet = PetManager.instance.createStarter(Species.Dog, 'Viejo');
    expect(PetManager.instance.rename(pet.id, '  Nuevo  ')).toBe(true);
    expect(pet.name).toBe('Nuevo');
    expect(PetManager.instance.rename(pet.id, '   ')).toBe(false);
  });
});

describe('EconomySystem', () => {
  it('comprar descuenta monedas y añade al inventario', () => {
    const coins = EconomySystem.instance.coins;
    expect(EconomySystem.instance.buy('food_fish').ok).toBe(true);
    expect(EconomySystem.instance.coins).toBe(coins - 25);
    expect(EconomySystem.instance.quantity('food_fish')).toBe(1);
  });

  it('no permite comprar sin fondos ni accesorios repetidos', () => {
    expect(EconomySystem.instance.buy('acc_crown').ok).toBe(false);
    expect(EconomySystem.instance.buy('acc_bow').ok).toBe(true);
    const again = EconomySystem.instance.buy('acc_bow');
    expect(again.ok).toBe(false);
  });

  it('los accesorios suben la belleza efectiva', () => {
    const pet = PetManager.instance.createStarter(Species.Cat, 'Kira');
    const before = pet.effectiveBeauty;
    EconomySystem.instance.buy('acc_bow');
    EconomySystem.instance.equip(pet.id, 'acc_bow');
    expect(pet.effectiveBeauty).toBe(Math.min(100, before + 5));
  });

  it('recompensa diaria una vez al día', () => {
    expect(EconomySystem.instance.claimDaily()).not.toBeNull();
    expect(EconomySystem.instance.claimDaily()).toBeNull();
  });
});

describe('EventSystem (competencias)', () => {
  it('solo adultos pueden competir', () => {
    const pet = PetManager.instance.createStarter(Species.Dog, 'Rocky');
    const r = EventSystem.instance.canEnter(pet, 'agility_race');
    expect(r.ok).toBe(false);
  });

  it('calcula calificación 1-5 y entrega recompensas', () => {
    const pet = PetManager.instance.createStarter(Species.Dog, 'Rocky');
    GrowthSystem.instance.addDays(pet, 15);
    pamper(pet);
    pet.stats.agility = 90;
    const coins = EconomySystem.instance.coins;
    const session = EventSystem.instance.start(pet.id, 'agility_race') as CompetitionSession;
    expect(session.competitionId).toBe('agility_race');
    const result = EventSystem.instance.finish(session, 1);
    expect(result.rating).toBeGreaterThanOrEqual(4);
    expect(EconomySystem.instance.coins).toBe(coins - 20 + result.coins);
    // Cooldown activo tras competir
    expect(EventSystem.instance.canEnter(pet, 'agility_race').ok).toBe(false);
  });
});

describe('BreedingSystem', () => {
  function adult(name: string, sex: Sex) {
    const pet = Pet.create({ name, speciesId: Species.Cat, now, sex });
    PetManager.instance.add(pet, 'adopted');
    GrowthSystem.instance.addDays(pet, 15);
    pamper(pet);
    return pet;
  }

  it('aparea adultos de la misma especie y sexo opuesto; la cría hereda rasgos', async () => {
    const mom = adult('Mamá', Sex.Female);
    const dad = adult('Papá', Sex.Male);
    const r = await BreedingSystem.instance.breed(mom.id, { kind: 'own', pet: dad }, 'Gatito');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.baby.stage).toBe(GrowthStage.Baby);
    expect(r.baby.data.generation).toBe(2);
    const colors = [mom.data.genes.primaryColor, dad.data.genes.primaryColor, ...r.baby.species.primaryPalette];
    expect(colors).toContain(r.baby.data.genes.primaryColor);
    expect(BreedingSystem.instance.canBreed(mom).ok).toBe(false);
  });

  it('no aparea mismo sexo ni bebés', async () => {
    const a = adult('A', Sex.Female);
    const b = adult('B', Sex.Female);
    expect((await BreedingSystem.instance.breed(a.id, { kind: 'own', pet: b })).ok).toBe(false);
    const baby = Pet.create({ name: 'Bebe', speciesId: Species.Cat, now, sex: Sex.Male });
    PetManager.instance.add(baby, 'adopted');
    expect(BreedingSystem.instance.canBreed(baby).ok).toBe(false);
  });

  it('sin servidor no se puede publicar en adopción ni hay adopciones inventadas', async () => {
    const mom = adult('Mamá', Sex.Female);
    adult('Papá', Sex.Male);
    const r = await BreedingSystem.instance.listForAdoption(mom.id);
    expect(r.ok).toBe(false);
    expect(mom.data.location).toBe(PetLocation.Active);
  });
});

describe('Servidor (Google Sheets)', () => {
  const calls: Record<string, unknown>[] = [];
  beforeEach(() => {
    calls.length = 0;
    OnlineService.instance.setUrl('https://script.google.com/macros/s/TEST/exec');
  });
  afterEach(() => {
    OnlineService.instance.setUrl('');
  });

  it('publica una cría, otro jugador la adopta y al sincronizar cobras', async () => {
    const mom = Pet.create({ name: 'Mamá', speciesId: Species.Dog, now });
    const kid = Pet.create({ name: 'Peque', speciesId: Species.Dog, now });
    PetManager.instance.add(mom, 'adopted');
    PetManager.instance.add(kid, 'born');
    OnlineService.instance.transport = async (_m, _u, payload) => {
      calls.push(payload);
      if (payload.accion === 'publicarAdopcion') return { ok: true, oferta: 'of1' };
      if (payload.accion === 'sincronizar') return { ok: true, monedas: 90, adoptadas: [{ oferta: 'of1', mascotaId: kid.id, precio: 90 }] };
      return { ok: true };
    };
    expect((await BreedingSystem.instance.listForAdoption(kid.id)).ok).toBe(true);
    expect(kid.data.location).toBe(PetLocation.Adoption);
    const coins = EconomySystem.instance.coins;
    expect(await GameManager.instance.syncOnline()).toBe(true);
    expect(PetManager.instance.get(kid.id)).toBeUndefined();
    expect(EconomySystem.instance.coins).toBe(coins + 90);
    expect(calls.every((c) => typeof c.id === 'string' && /^[a-f0-9]{24}$/.test(c.id as string))).toBe(true);
  });

  it('aparea con la mascota de otro jugador pagando su tarifa', async () => {
    const mom = Pet.create({ name: 'Mamá', speciesId: Species.Cat, now, sex: Sex.Female });
    PetManager.instance.add(mom, 'adopted');
    GrowthSystem.instance.addDays(mom, 15);
    pamper(mom);
    OnlineService.instance.transport = async (_m, _u, payload) => {
      if (payload.accion === 'parejas') return { ok: true, lista: [{ anuncio: 'a1', duenoApodo: 'Patita Feliz 123', nombre: 'Duque', especie: 'cat', sexo: 'male', genes: { primaryColor: '#123456' }, tarifa: 100 }] };
      if (payload.accion === 'usarPareja') return { ok: true, nombre: 'Duque', genes: { primaryColor: '#123456' } };
      return { ok: true };
    };
    const { partners } = await BreedingSystem.instance.findPartners(mom);
    const online = partners.find((p) => p.kind === 'online')!;
    const coins = EconomySystem.instance.coins;
    const r = await BreedingSystem.instance.breed(mom.id, online, 'Michi');
    expect(r.ok).toBe(true);
    expect(EconomySystem.instance.coins).toBe(coins - 100);
  });

  it('si el servidor falla al usar la pareja, devuelve las monedas', async () => {
    const mom = Pet.create({ name: 'Mamá', speciesId: Species.Cat, now, sex: Sex.Female });
    PetManager.instance.add(mom, 'adopted');
    GrowthSystem.instance.addDays(mom, 15);
    pamper(mom);
    OnlineService.instance.transport = async () => {
      throw new Error('red');
    };
    const coins = EconomySystem.instance.coins;
    const listing = { anuncio: 'a1', duenoApodo: 'X', nombre: 'Duque', especie: 'cat', sexo: Sex.Male, genes: {}, tarifa: 100 };
    const r = await BreedingSystem.instance.breed(mom.id, { kind: 'online', listing });
    expect(r.ok).toBe(false);
    expect(EconomySystem.instance.coins).toBe(coins);
  });
});

describe('Minijuegos y misiones', () => {
  it('jugar da monedas con tope diario y guarda el récord', () => {
    const pet = PetManager.instance.createStarter(Species.Dog, 'Toby');
    pamper(pet);
    const r1 = GamesSystem.instance.finish(pet.id, 'bubbles', 30);
    expect(r1.coins).toBe(15);
    expect(r1.record).toBe(true);
    pet.stats.energy = 100;
    for (let i = 0; i < 5; i++) GamesSystem.instance.finish(pet.id, 'bubbles', 30);
    expect(GamesSystem.instance.coinsToday('bubbles')).toBe(60);
  });

  it('los juegos se desbloquean por etapa', () => {
    const pet = PetManager.instance.createStarter(Species.Dog, 'Toby');
    pamper(pet);
    expect(GamesSystem.instance.canPlay(pet, 'bubbles').ok).toBe(true);
    expect(GamesSystem.instance.canPlay(pet, 'runner').ok).toBe(false);
  });

  it('las misiones avanzan con las acciones y se cobran', () => {
    MissionSystem.instance.start();
    const pet = PetManager.instance.createStarter(Species.Dog, 'Toby');
    pamper(pet);
    const missions = MissionSystem.instance.today();
    expect(missions).toHaveLength(3);
    // Completar a mano la primera para comprobar el cobro
    missions[0].state.progress = missions[0].def.goal;
    const coins = EconomySystem.instance.coins;
    expect(MissionSystem.instance.claim(missions[0].def.id)).toBe(missions[0].def.reward);
    expect(EconomySystem.instance.coins).toBe(coins + missions[0].def.reward);
  });
});

describe('SaveSystem', () => {
  it('guarda y carga el estado completo, aplicando tiempo offline', async () => {
    const pet = PetManager.instance.createStarter(Species.Hamster, 'Nugget');
    pet.stats.hunger = 20;
    EconomySystem.instance.addCoins(77);
    await SaveSystem.instance.save();
    const coins = EconomySystem.instance.coins;

    GameState.instance.reset(now); // "cerramos la app"
    PetManager.instance.rebuild();

    now += 3 * HOUR;
    Clock.setNow(now);
    const report = await SaveSystem.instance.load();
    expect(report?.offlineMs).toBe(3 * HOUR);
    const loaded = PetManager.instance.get(pet.id)!;
    expect(loaded.name).toBe('Nugget');
    expect(EconomySystem.instance.coins).toBe(coins);
    expect(loaded.stats.hunger).toBeGreaterThan(20);
    expect(loaded.data.ageDays).toBeCloseTo(3, 1);
    expect(GameState.instance.data.album.length).toBeGreaterThan(0);
  });

  it('una noche offline (8 h) dormida no hace escapar a la mascota', () => {
    const pet = PetManager.instance.createStarter(Species.Dog, 'Luna');
    pamper(pet);
    pet.data.sleeping = true;
    advance(8 * HOUR, true);
    expect(pet.isActive).toBe(true);
  });
});
