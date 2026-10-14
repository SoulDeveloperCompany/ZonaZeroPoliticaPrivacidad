import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Clock } from '../src/core/Clock';
import { GameManager } from '../src/core/GameManager';
import { GamesSystem } from '../src/systems/games/GamesSystem';
import { MissionSystem } from '../src/systems/games/MissionSystem';
import { OnlineService } from '../src/systems/online/OnlineService';
import { EventBus } from '../src/core/EventBus';
import { GameConfig } from '../src/core/GameConfig';
import { OnlineConfig } from '../src/core/OnlineConfig';
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
import { Analytics } from '../src/systems/online/Analytics';
import { BondSystem, BOND_PER_DAY } from '../src/systems/pet/BondSystem';
import { TRAITS } from '../src/data/traits';
import { CollectionSystem, SPECIES_COMPLETE_STARS } from '../src/systems/breeding/CollectionSystem';
import { DataRegistry } from '../src/data/DataRegistry';
import { Community } from '../src/systems/online/Community';
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
  // Los tests nunca deben hablar con el servidor real (la URL de serie está en OnlineConfig)
  OnlineConfig.DEFAULT_URL = '';
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

  it('si pasan 48 h sin encontrarla vuelve sola a casa (nunca se pierde)', () => {
    const pet = PetManager.instance.createStarter(Species.Turtle, 'Tuga');
    pet.stats.health = 0.5;
    pet.stats.hunger = 100;
    advance(HOUR);
    expect(pet.isEscaped).toBe(true);
    advance(49 * HOUR, true);
    expect(PetManager.instance.get(pet.id)?.isActive).toBe(true);
    expect(GameState.instance.data.album.some((m) => m.title === '¡Volvió sola a casa!')).toBe(true);
  });

  it.each([4, 24, 72, 168])('%i h sin abrir el juego: la salud no baja y no se escapa', (horas) => {
    const pet = PetManager.instance.createStarter(Species.Dog, 'Toby');
    Object.assign(pet.stats, { hunger: 5, happiness: 100, energy: 100, health: 100, hygiene: 100 });
    advance(horas * HOUR, true);
    const s = PetManager.instance.get(pet.id)!;
    expect(s.isActive).toBe(true);
    expect(s.stats.health).toBe(100);
    expect(s.stats.hunger).toBeLessThanOrEqual(GameConfig.OFFLINE_LIMITS.maxHunger + 0.001);
    expect(s.stats.happiness).toBeGreaterThanOrEqual(GameConfig.OFFLINE_LIMITS.minHappiness - 0.001);
    expect(s.stats.hygiene).toBeGreaterThanOrEqual(GameConfig.OFFLINE_LIMITS.minHygiene - 0.001);
  });

  it('offline no empeora lo que ya estaba peor que el límite', () => {
    const pet = PetManager.instance.createStarter(Species.Dog, 'Toby');
    Object.assign(pet.stats, { hunger: 85, happiness: 20, energy: 60, health: 70, hygiene: 25 });
    advance(24 * HOUR, true);
    expect(pet.stats.hunger).toBeLessThanOrEqual(85.001);
    expect(pet.stats.happiness).toBeGreaterThanOrEqual(19.999);
    expect(pet.stats.health).toBeGreaterThanOrEqual(70);
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
  it('la edad va en días reales: cachorro al día 1, juvenil al 3, adulto al 7 y senior al 60', () => {
    const pet = PetManager.instance.createStarter(Species.Dog, 'Rex');
    const enDia: Record<number, GrowthStage> = {};
    for (let d = 1; d <= 61; d++) {
      for (let h = 0; h < 24; h += 6) {
        pamper(pet);
        advance(6 * HOUR);
      }
      enDia[d] = pet.stage;
    }
    expect(pet.data.ageDays).toBeCloseTo(61, 1);
    expect(enDia[1]).toBe(GrowthStage.Puppy);
    expect(enDia[2]).toBe(GrowthStage.Puppy);
    expect(enDia[3]).toBe(GrowthStage.Juvenile);
    expect(enDia[7]).toBe(GrowthStage.Adult);
    expect(enDia[59]).toBe(GrowthStage.Adult);
    expect(pet.stage).toBe(GrowthStage.Senior);
    expect(GrowthSystem.instance.isUnlocked(pet, 'breed')).toBe(true);
  });

  it('una noche fuera (8 h) no pasa de bebé a juvenil: los hitos ya no ocurren mientras duermes', () => {
    const pet = PetManager.instance.createStarter(Species.Dog, 'Rex');
    advance(8 * HOUR, true);
    expect(pet.stage).toBe(GrowthStage.Baby);
  });

  it('el buen cuidado temprano da +10% a los stats base del adulto', () => {
    const cared = PetManager.instance.createStarter(Species.Dog, 'Bien');
    const baseAgility = cared.data.genes.baseAgility;
    for (let h = 0; h < 7 * 24 + 2; h += 2) {
      pamper(cared);
      advance(2 * HOUR);
    }
    expect(cared.stage).toBe(GrowthStage.Adult);
    expect(cared.data.wellCared).toBe(true);
    expect(cared.data.genes.baseAgility).toBe(Math.round(baseAgility * 1.1));
  });

  it('la barra de progreso va de 0 a 1 entre etapas', () => {
    const pet = PetManager.instance.createStarter(Species.Cat, 'Mia');
    pet.data.ageDays = 0.5;
    const p = GrowthSystem.instance.progress(pet);
    expect(p.progress).toBeCloseTo(0.5);
    expect(p.next?.id).toBe(GrowthStage.Puppy);
  });

  it('las vitaminas suman 6 h de crecimiento, con un máximo de 2 al día', () => {
    const pet = PetManager.instance.createStarter(Species.Parrot, 'Kiwi');
    EconomySystem.instance.addItem('acc_growth_vitamin', 4);
    expect(EconomySystem.instance.useItem(pet.id, 'acc_growth_vitamin').ok).toBe(true);
    expect(EconomySystem.instance.useItem(pet.id, 'acc_growth_vitamin').ok).toBe(true);
    const tercera = EconomySystem.instance.useItem(pet.id, 'acc_growth_vitamin');
    expect(tercera.ok).toBe(false);
    expect(EconomySystem.instance.quantity('acc_growth_vitamin')).toBe(2);
    expect(pet.data.ageDays).toBeCloseTo(0.5, 3);
    advance(24 * HOUR, true);
    expect(EconomySystem.instance.useItem(pet.id, 'acc_growth_vitamin').ok).toBe(true);
  });

  it('migra partidas v1 (edad en horas) a v2 sin que nadie retroceda de etapa', () => {
    const casos: [number, GrowthStage][] = [[2, GrowthStage.Baby], [5, GrowthStage.Puppy], [10, GrowthStage.Juvenile], [20, GrowthStage.Adult], [50, GrowthStage.Senior]];
    for (const [edad, etapa] of casos) {
      const p = Pet.create({ name: 'V1', speciesId: Species.Dog, now }).data;
      p.ageDays = edad;
      p.stage = etapa;
      const data = SaveSystem.instance.migrate({ ...GameState.instance.data, version: 1, pets: [p] });
      expect(GrowthSystem.instance.stageForAge(data.pets[0].ageDays)).toBe(etapa);
    }
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

  it('envía las estadísticas anónimas en la sincronización y las borra al confirmarse', async () => {
    (Analytics as unknown as { _instance: Analytics | null })._instance = null;
    Analytics.instance.start();
    const pet = PetManager.instance.createStarter(Species.Dog, 'Toby');
    EventBus.instance.emit('pet:stageChanged', { petId: pet.id, from: GrowthStage.Baby, to: GrowthStage.Puppy });
    OnlineService.instance.transport = async (_m, _u, payload) => {
      calls.push(payload);
      return { ok: true, monedas: 0, adoptadas: [], regalos: [] };
    };
    expect(await GameManager.instance.syncOnline()).toBe(true);
    const enviados = calls[0].eventos as { e: string; x?: string }[];
    expect(enviados.map((x) => x.e)).toEqual(expect.arrayContaining(['sesion', 'adopcion_inicial', 'etapa']));
    expect(enviados.find((x) => x.e === 'etapa')?.x).toBe(GrowthStage.Puppy);
    expect(GameState.instance.data.online.pendingEvents).toHaveLength(0);
  });

  it('si el jugador desactiva las estadísticas no se guarda ni se envía nada', () => {
    Analytics.instance.setEnabled(false);
    Analytics.instance.track('compra', 'food_cake');
    expect(Analytics.instance.pending()).toHaveLength(0);
    Analytics.instance.setEnabled(true);
  });

  it('recibe regalos escritos en la hoja (monedas, estrellas y objeto)', async () => {
    PetManager.instance.createStarter(Species.Dog, 'Toby');
    OnlineService.instance.transport = async () => ({
      ok: true, monedas: 0, adoptadas: [],
      regalos: [{ regalo: 'Bienvenida', monedas: 500, estrellas: 5, objeto: 'acc_crown', cantidad: 1, mensaje: 'Hola' }],
    });
    const coins = EconomySystem.instance.coins;
    const stars = EconomySystem.instance.stars;
    expect(await GameManager.instance.syncOnline()).toBe(true);
    expect(EconomySystem.instance.coins).toBe(coins + 500);
    expect(EconomySystem.instance.stars).toBe(stars + 5);
    expect(EconomySystem.instance.quantity('acc_crown')).toBe(1);
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
    expect(loaded.data.ageDays).toBeCloseTo(3 / 24, 2);
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

describe('Guardado robusto', () => {
  it('si la partida principal está dañada, carga la copia de respaldo', async () => {
    const pet = PetManager.instance.createStarter(Species.Cat, 'Michi');
    await SaveSystem.instance.save();
    await SaveSystem.instance.storage.set('mascota_virtual_save', '{"pets": [ roto');
    GameState.instance.reset(now);
    PetManager.instance.rebuild();
    await SaveSystem.instance.load();
    expect(PetManager.instance.get(pet.id)?.name).toBe('Michi');
    expect(SaveSystem.instance.recoveredFrom).toBe('backup');
  });

  it('si las dos están dañadas, empieza de nuevo sin bloquear el juego y guarda lo dañado', async () => {
    await SaveSystem.instance.storage.set('mascota_virtual_save', 'basura');
    await SaveSystem.instance.storage.set('mascota_virtual_save_bak', '{"sin":"mascotas"}');
    await expect(SaveSystem.instance.load()).resolves.toBeNull();
    expect(PetManager.instance.all()).toHaveLength(0);
    expect(SaveSystem.instance.recoveredFrom).toBe('none');
    expect(await SaveSystem.instance.storage.get('mascota_virtual_save_danada')).toBe('basura');
  });
});

describe('Vínculo, carácter y recuerdos', () => {
  beforeEach(() => {
    (BondSystem as unknown as { _instance: BondSystem | null })._instance = null;
    BondSystem.instance.start();
  });

  it('cada mascota nace con 2 rasgos distintos de la lista', () => {
    const pet = PetManager.instance.createStarter(Species.Dog, 'Rex');
    expect(pet.data.traits).toHaveLength(2);
    expect(new Set(pet.data.traits).size).toBe(2);
    expect(pet.data.traits.every((t) => TRAITS.some((x) => x.id === t))).toBe(true);
  });

  it('el vínculo premia la variedad, tiene tope diario y nunca baja', () => {
    const pet = PetManager.instance.createStarter(Species.Dog, 'Rex');
    pet.data.traits = ['curioso', 'presumido']; // sin modificadores de vínculo
    BondSystem.instance.onCare(pet, 'pet');
    const tras1 = pet.data.bond;
    BondSystem.instance.onCare(pet, 'pet');
    expect(pet.data.bond - tras1).toBeLessThan(tras1); // repetir vale menos
    for (let i = 0; i < 50; i++) BondSystem.instance.onCare(pet, ['pet', 'feed', 'bathe', 'play'][i % 4]);
    expect(pet.data.bond).toBeCloseTo(BOND_PER_DAY, 5); // tope del día
    advance(72 * HOUR, true);
    expect(pet.data.bond).toBeCloseTo(BOND_PER_DAY, 5); // no baja por no entrar
  });

  it('al cruzar 20 de vínculo guarda el hito en el álbum y lo anuncia', () => {
    const pet = PetManager.instance.createStarter(Species.Cat, 'Mia');
    pet.data.traits = ['curioso', 'presumido'];
    const hitos: number[] = [];
    EventBus.instance.on('pet:bondMilestone', ({ level }) => hitos.push(level));
    pet.data.bond = 19.9;
    BondSystem.instance.gain(pet, 1);
    expect(hitos).toEqual([20]);
    expect(GameState.instance.data.album.some((m) => m.kind === 'bond')).toBe(true);
  });

  it('el carácter tímido gana vínculo más despacio y el cariñoso más rápido', () => {
    const a = PetManager.instance.createStarter(Species.Dog, 'A');
    a.data.traits = ['timido', 'curioso'];
    BondSystem.instance.gain(a, 4);
    const b = Pet.create({ name: 'B', speciesId: Species.Dog, now });
    PetManager.instance.add(b, 'adopted');
    b.data.traits = ['carinoso', 'curioso'];
    BondSystem.instance.gain(b, 4);
    expect(a.data.bond).toBeCloseTo(3, 5);
    expect(b.data.bond).toBeCloseTo(5, 5);
  });

  it('las primeras veces y la comida favorita se guardan solas', () => {
    const pet = PetManager.instance.createStarter(Species.Dog, 'Rex');
    BondSystem.instance.onCare(pet, 'bathe');
    BondSystem.instance.onCare(pet, 'bathe');
    expect(GameState.instance.data.album.filter((m) => m.title === 'Su primer baño')).toHaveLength(1);
    for (let i = 0; i < 5; i++) BondSystem.instance.onCare(pet, 'feed', 'food_fruit');
    expect(pet.data.favoriteFood).toBe('food_fruit');
  });

  it('cumple meses cada 30 días de edad', () => {
    PetManager.instance.createStarter(Species.Dog, 'Rex');
    const cumple: number[] = [];
    EventBus.instance.on('pet:birthday', ({ months }) => cumple.push(months));
    advance(61 * 24 * HOUR, true);
    expect(cumple).toEqual([1, 2]);
    expect(GameState.instance.data.album.filter((m) => m.kind === 'birthday')).toHaveLength(2);
  });

  it('las partidas antiguas reciben rasgos y vínculo al cargarse', () => {
    const p = Pet.create({ name: 'Vieja', speciesId: Species.Dog, now }).data as unknown as Record<string, unknown>;
    for (const k of ['traits', 'bond', 'bondToday', 'firsts', 'foodCounts', 'favoriteFood', 'birthdayMonths', 'recentActions']) delete p[k];
    const data = SaveSystem.instance.migrate({ ...GameState.instance.data, pets: [p as never] });
    expect(data.pets[0].traits).toHaveLength(2);
    expect(data.pets[0].bond).toBe(0);
  });
});

describe('Economía: decoración, venta y colección', () => {
  it('compra un tema de decoración, se pone solo y se puede volver al anterior', () => {
    EconomySystem.instance.addCoins(1000);
    expect(GameState.instance.data.decor.pared).toBe('pared_clasica');
    expect(EconomySystem.instance.buy('pared_menta').ok).toBe(true);
    expect(GameState.instance.data.decor.pared).toBe('pared_menta');
    expect(EconomySystem.instance.buy('pared_menta').ok).toBe(false); // no se compra dos veces
    expect(EconomySystem.instance.applyDecor('pared_clasica')).toBe(true);
    expect(EconomySystem.instance.applyDecor('pared_galaxia')).toBe(false); // no comprada
  });

  it('vende lo que sobra a mitad de precio (lo de estrellas y lo gratis no se vende)', () => {
    EconomySystem.instance.addItem('food_meat', 2);
    const antes = EconomySystem.instance.coins;
    expect(EconomySystem.instance.sell('food_meat')).toBe(15);
    expect(EconomySystem.instance.coins).toBe(antes + 15);
    expect(EconomySystem.instance.quantity('food_meat')).toBe(1);
    EconomySystem.instance.addItem('acc_growth_clock', 1);
    expect(EconomySystem.instance.sell('acc_growth_clock')).toBe(0);
    expect(EconomySystem.instance.sellPrice('food_basic')).toBe(0);
  });

  it('las crías pueden salir con colores raros (más a menudo si un padre ya es raro)', () => {
    const bs = BreedingSystem.instance;
    const sp = DataRegistry.instance.getSpecies(Species.Dog);
    const normal = { ...Pet.randomGenes(sp), primaryColor: sp.primaryPalette[0] };
    const raro = { ...normal, primaryColor: sp.rarePalette![0] };
    let sinPadreRaro = 0;
    let conPadreRaro = 0;
    for (let i = 0; i < 4000; i++) {
      if (sp.rarePalette!.includes(bs.inheritGenes(normal, normal, Species.Dog).primaryColor)) sinPadreRaro++;
      const g = bs.inheritGenes(raro, normal, Species.Dog).primaryColor;
      if (sp.rarePalette!.includes(g) && g !== raro.primaryColor) conPadreRaro++;
    }
    expect(sinPadreRaro / 4000).toBeGreaterThan(0.015);
    expect(sinPadreRaro / 4000).toBeLessThan(0.05);
    expect(conPadreRaro).toBeGreaterThan(sinPadreRaro * 0.8); // el padre raro sube la probabilidad
  });

  it('el libro de pelajes apunta colores nuevos y premia completar una especie', () => {
    (CollectionSystem as unknown as { _instance: CollectionSystem | null })._instance = null;
    CollectionSystem.instance.start();
    const sp = DataRegistry.instance.getSpecies(Species.Cat);
    const estrellas = EconomySystem.instance.stars;
    for (const color of [...sp.primaryPalette, ...sp.rarePalette!]) {
      const p = Pet.create({ name: 'C', speciesId: Species.Cat, now, genes: { ...Pet.randomGenes(sp), primaryColor: color } });
      PetManager.instance.add(p, 'adopted');
    }
    const fila = CollectionSystem.instance.rows().find((r) => r.speciesId === Species.Cat)!;
    expect(fila.colors.every((c) => c.found)).toBe(true);
    expect(EconomySystem.instance.stars).toBe(estrellas + SPECIES_COMPLETE_STARS);
    expect(GameState.instance.data.album.some((m) => m.title.includes('raro'))).toBe(true);
  });
});

describe('Comunidad: desafío semanal', () => {
  beforeEach(() => {
    (Community as unknown as { _instance: Community | null })._instance = null;
    Community.instance.start();
  });

  it('cuenta los cuidados como aportes, los envía y deja recoger el premio si se cumple entre todos', async () => {
    const pet = PetManager.instance.createStarter(Species.Dog, 'Toby');
    pet.stats.hunger = 60;
    InteractionSystem.instance.perform(pet.id, 'feed');
    InteractionSystem.instance.perform(pet.id, 'pet');
    const enviados: Record<string, unknown>[] = [];
    let progreso = 10;
    OnlineService.instance.setUrl('https://script.google.com/macros/s/TEST/exec');
    OnlineService.instance.transport = async (_m, _u, payload) => {
      enviados.push(payload);
      return { ok: true, monedas: 0, adoptadas: [], regalos: [], buzon: [{ de: 'Bigote', monedas: 15 }],
        desafio: { semana: '2900', accion: 'feed', titulo: 'Entre todos, 20 comidas', objetivo: 20, progreso, premio: { monedas: 100, estrellas: 1 } } };
    };
    const monedas = EconomySystem.instance.coins;
    await GameManager.instance.syncOnline();
    expect(enviados[0].aportes).toEqual({ feed: 1, pet: 1 });
    expect(GameState.instance.data.community.pending).toEqual({});
    expect(EconomySystem.instance.coins).toBe(monedas + 15); // golosina del buzón
    expect(Community.instance.myContribution).toBe(1);
    expect(Community.instance.canClaim()).toBe(false); // aún no se llegó al objetivo
    progreso = 25;
    await GameManager.instance.syncOnline();
    expect(Community.instance.canClaim()).toBe(true);
    const estrellas = EconomySystem.instance.stars;
    expect(Community.instance.claim()).toBe(true);
    expect(EconomySystem.instance.stars).toBe(estrellas + 1);
    expect(Community.instance.claim()).toBe(false); // solo una vez
  });
});
