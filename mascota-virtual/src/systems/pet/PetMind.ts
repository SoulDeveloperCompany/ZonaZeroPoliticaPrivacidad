/**
 * PetMind (Singleton): la "mente" de cada mascota. Aprende de ti en el propio móvil, sin internet ni coste.
 *
 * 1. Aprendizaje por refuerzo (bandido multibrazo): cada conducta en reposo tiene un valor Q.
 *    Si la acaricias justo después de que haga algo, ese valor sube y lo repetirá más; lo que ignoras se apaga.
 *    Cuando una conducta queda claramente aprendida, la mascota lo "anuncia".
 * 2. Rutina: recuerda a qué horas sueles venir (histograma de 24 h con olvido). Si llegas a tu hora,
 *    te esperaba; si llevas días sin venir, te echó de menos.
 * 3. Gustos innatos y ocultos por comida: se descubren al darle a probar cada una.
 * 4. Vocabulario: oye las palabras de lo que haces con ella y, con la edad y el vínculo, las aprende
 *    (el loro aprende el doble de rápido). Un bebé solo hace ruiditos; un adulto ya te habla.
 * 5. Recuerdos: guarda momentos y a veces te los recuerda.
 *
 * Todo es lógica pura (testeable); la UI decide cómo mostrarlo.
 */
import { Clock } from '../../core/Clock';
import { EventBus } from '../../core/EventBus';
import { DataRegistry } from '../../data/DataRegistry';
import { getTrait } from '../../data/traits';
import type { Pet } from './Pet';
import { PetManager } from './PetManager';
import { GrowthStage, Sex } from './PetTypes';
import { PLAY_GAMES } from '../../data/games';

export interface PetMemory {
  t: number;
  /** Frase en primera persona, p. ej. "cuando probé el filete". */
  text: string;
  icon: string;
}

export interface PetMindData {
  /** Valor aprendido de cada conducta (−1..1). */
  q: Record<string, number>;
  /** Veces que hizo cada conducta. */
  tries: Record<string, number>;
  /** Conductas ya anunciadas como aprendidas. */
  learned: string[];
  /** Visitas por hora del día (0-23), con olvido lento. */
  hours: number[];
  visits: number;
  lastVisit: number;
  /** Veces que ha oído cada palabra / palabras que ya sabe. */
  heard: Record<string, number>;
  words: string[];
  /** Comidas que ya probó (su gusto es visible). */
  tasted: string[];
  memories: PetMemory[];
  /** Última conducta y cuándo (para atribuirle la caricia). */
  last: { id: string; at: number } | null;
  /** Lo último que te pidió (para darte las gracias si le haces caso). */
  request?: { need: Need; at: number } | null;
  /** Lo que ha vivido hoy (para el diario) y las páginas del diario. */
  log?: DayLog;
  diary?: DiaryEntry[];
}

export type Need = 'feed' | 'bathe' | 'play';

export interface DayLog {
  day: string;
  actions: Record<string, number>;
  foods: string[];
  games: string[];
  news: string[];
}

export interface DiaryEntry {
  day: string;
  text: string;
  /** Escrita con IA en la nube (se puede denunciar). */
  ai?: boolean;
}

const MAX_DIARY = 14;
const dayKey = (now: number) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

/** Conductas en reposo: clase CSS, idea (emoji del bocadillo) y nombre para contarlo. */
export interface Behavior {
  id: string;
  cls: string;
  idea: string | null;
  /** "le encanta que <name>" */
  name: string;
}

const B: Record<string, Behavior> = {
  hop: { id: 'hop', cls: 'idle-hop', idea: null, name: 'dé saltitos' },
  tilt: { id: 'tilt', cls: 'idle-tilt', idea: null, name: 'ladee la cabeza' },
  look: { id: 'look', cls: 'idle-look', idea: null, name: 'mire a su alrededor' },
  wiggle: { id: 'wiggle', cls: 'idle-wiggle', idea: null, name: 'se menee' },
  stretch: { id: 'stretch', cls: 'idle-stretch', idea: null, name: 'se estire' },
  dance: { id: 'dance', cls: 'idle-dance', idea: '🎵', name: 'baile' },
  spin: { id: 'spin', cls: 'anim-spin', idea: '🌀', name: 'dé vueltas' },
  love: { id: 'love', cls: 'idle-hop', idea: '💕', name: 'te mande corazones' },
  ball: { id: 'ball', cls: 'idle-hop', idea: '🎾', name: 'te traiga la pelota' },
  bowl: { id: 'bowl', cls: 'idle-look', idea: '🍖', name: 'mire su cuenco' },
  scratch: { id: 'scratch', cls: 'idle-wiggle', idea: '🫧', name: 'se rasque' },
  peek: { id: 'peek', cls: 'idle-tilt', idea: '👀', name: 'se asome con timidez' },
  sniff: { id: 'sniff', cls: 'idle-look', idea: '🔍', name: 'lo olfatee todo' },
  pose: { id: 'pose', cls: 'anim-pose', idea: '✨', name: 'pose para ti' },
  yawn: { id: 'yawn', cls: 'idle-yawn', idea: '💤', name: 'bostece' },
};

/** Palabras que puede aprender y qué acción se las enseña. */
const WORD_BY_ACTION: Record<string, string> = {
  feed: 'comida', play: 'pelota', bathe: 'baño', walk: 'paseo', pet: 'mimos', train: 'truco',
};

export const SOUND: Record<string, string> = {
  dog: '¡Guau!', cat: '¡Miau!', rabbit: '¡Mip!', parrot: '¡Cruac!', turtle: '¡Mmm!', hamster: '¡Iiik!',
};

const ALPHA = 0.3; // velocidad de aprendizaje
const LEARNED_AT = 0.55;
const FORGET = 0.025; // cuánto se apaga una conducta cada vez que la ignoras
const REWARD_WINDOW = 6000; // ms tras la conducta en que una caricia cuenta como premio
const WORD_EXPOSURES = 4;
const MAX_MEMORIES = 30;

/** Hash estable 0..1 (gustos innatos reproducibles sin guardarlos). */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

export type Taste = 'love' | 'like' | 'dislike';

export class PetMind {
  private static _instance: PetMind | null = null;

  static get instance(): PetMind {
    if (!this._instance) this._instance = new PetMind();
    return this._instance;
  }

  /** Mente de la mascota (se crea sola en partidas antiguas). */
  of(pet: Pet): PetMindData {
    const d = pet.data;
    d.mind ??= { q: {}, tries: {}, learned: [], hours: new Array(24).fill(0), visits: 0, lastVisit: 0, heard: {}, words: [], tasted: [], memories: [], last: null };
    return d.mind;
  }

  private started = false;

  /** Escucha lo que pasa en el juego. Se llama una vez al arrancar. */
  start(): void {
    if (this.started) return;
    this.started = true;
    const bus = EventBus.instance;
    bus.on('interaction:performed', ({ petId, actionId, itemId }) => {
      const pet = PetManager.instance.get(petId);
      if (!pet) return;
      if (actionId === 'feed' && itemId) {
        const { taste, discovered } = this.onFed(pet, itemId);
        if (taste !== 'like') {
          pet.applyDeltas({ happiness: taste === 'love' ? 3 : -2 });
          bus.emit('mind:say', { petId, text: this.say(pet, taste === 'love' ? 'love-food' : 'dislike-food') });
          if (discovered) {
            const item = DataRegistry.instance.getItem(itemId);
            bus.emit('ui:toast', {
              text: taste === 'love' ? `😋 ¡Descubriste que a ${pet.name} le encanta: ${item.name}!` : `😖 A ${pet.name} no le gusta mucho: ${item.name}`,
              kind: taste === 'love' ? 'good' : 'info',
            });
          }
        }
      }
      this.onAction(pet, actionId);
      const day = this.today(pet);
      day.actions[actionId] = (day.actions[actionId] ?? 0) + 1;
      if (actionId === 'feed' && itemId) {
        const name = DataRegistry.instance.getItem(itemId).name.toLowerCase();
        if (!day.foods.includes(name)) day.foods.push(name);
      }
      this.fulfil(pet, actionId as Need);
    });
    bus.on('game:finished', ({ petId, gameId }) => {
      const pet = PetManager.instance.get(petId);
      if (!pet) return;
      const name = PLAY_GAMES.find((g) => g.id === gameId)?.name ?? gameId;
      const day = this.today(pet);
      if (!day.games.includes(name)) day.games.push(name);
      this.fulfil(pet, 'play');
    });
    bus.on('trick:learned', ({ petId, trickId }) => {
      const pet = PetManager.instance.get(petId);
      const trick = pet?.species.tricks.find((t) => t.id === trickId);
      if (pet && trick) this.remember(pet, `cuando aprendí «${trick.name.toLowerCase()}»`, trick.icon);
    });
    bus.on('competition:finished', ({ petId, rating }) => {
      const pet = PetManager.instance.get(petId);
      if (!pet) return;
      this.today(pet).news.push(`competí y saqué ${rating} ${rating === 1 ? 'estrella' : 'estrellas'}`);
      if (rating >= 4) this.remember(pet, `cuando saqué ${rating} estrellas en una competencia`, '🏆');
    });
    bus.on('pet:birthday', ({ petId, months }) => {
      const pet = PetManager.instance.get(petId);
      if (pet) this.remember(pet, `mi cumpleaños de ${months} ${months === 1 ? 'mes' : 'meses'}`, '🎂');
    });
  }

  // ---------- 1. Conductas que aprende de ti ----------

  /** Elige qué hacer en reposo: necesidades + carácter + lo aprendido (softmax sobre Q). */
  chooseBehavior(pet: Pet, now = Clock.now()): Behavior {
    const m = this.of(pet);
    const scored = this.weights(pet);
    const total = scored.reduce((t, [, x]) => t + x, 0);
    let r = Math.random() * total;
    for (const [b, x] of scored) {
      r -= x;
      if (r <= 0) return this.mark(m, b, now);
    }
    return this.mark(m, scored[0][0], now);
  }

  /** Peso de cada conducta ahora mismo (sin efectos: sirve para medir lo aprendido). */
  weights(pet: Pet): [Behavior, number][] {
    const m = this.of(pet);
    if (pet.isDrowsy) return [[B.yawn, 1]];
    const s = pet.stats;
    const prefs = new Set(pet.data.traits.flatMap((t) => getTrait(t)?.idle ?? []));
    const w: [Behavior, number][] = [[B.hop, 1], [B.tilt, 1], [B.look, 1], [B.wiggle, 1], [B.stretch, 0.6]];
    const add = (b: Behavior, base: number) => w.push([b, base + (prefs.has(b.id) ? 1.5 : 0)]);
    if (s.hunger > 60) add(B.bowl, 3);
    else if (prefs.has('bowl') && s.hunger > 35) add(B.bowl, 0.5);
    if (s.hygiene < 40) add(B.scratch, 2);
    if (s.happiness < 50 && s.energy > 30) add(B.ball, 2);
    else if (prefs.has('ball')) add(B.ball, 0.3);
    if (pet.data.bond >= 20) add(B.love, pet.data.bond / 40);
    if (pet.data.bond >= 40 && s.energy > 40) add(B.dance, 0.4);
    if (pet.data.bond >= 60 && pet.data.tricks.length > 0) add(B.spin, 1);
    if (prefs.has('peek') && pet.data.bond < 40) add(B.peek, 0.5);
    if (prefs.has('sniff')) add(B.sniff, 0.5);
    if (prefs.has('pose') && Object.keys(pet.data.equipped).length > 0) add(B.pose, 0.5);
    // Lo aprendido multiplica el peso: Q=1 → ×4,5 ; Q=−1 → ×0,2
    return w.map(([b, base]) => [b, base * Math.exp(1.5 * (m.q[b.id] ?? 0))] as [Behavior, number]);
  }

  /** Probabilidad de que elija esta conducta ahora. */
  chance(pet: Pet, id: string): number {
    const w = this.weights(pet);
    const total = w.reduce((t, [, x]) => t + x, 0);
    return w.filter(([b]) => b.id === id).reduce((t, [, x]) => t + x, 0) / total;
  }

  private mark(m: PetMindData, b: Behavior, now: number): Behavior {
    // La conducta anterior no recibió caricia: se apaga muy poco a poco (olvido lento)
    if (m.last && m.last.at > 0) m.q[m.last.id] = (m.q[m.last.id] ?? 0) + FORGET * (-0.2 - (m.q[m.last.id] ?? 0));
    m.last = { id: b.id, at: now };
    m.tries[b.id] = (m.tries[b.id] ?? 0) + 1;
    return b;
  }

  /**
   * La acariciaste: si acababa de hacer algo, eso se refuerza.
   * Devuelve la conducta si justo ahora la ha aprendido (para celebrarlo).
   */
  reward(pet: Pet, now = Clock.now(), amount = 1): Behavior | null {
    const m = this.of(pet);
    if (!m.last || now - m.last.at > REWARD_WINDOW) return null;
    const id = m.last.id;
    const q = m.q[id] ?? 0;
    m.q[id] = q + ALPHA * (amount - q);
    m.last = { id, at: 0 }; // una caricia por conducta
    if (m.q[id] >= LEARNED_AT && !m.learned.includes(id) && (m.tries[id] ?? 0) >= 3 && B[id]) {
      m.learned.push(id);
      this.remember(pet, `cuando aprendí que te gusta que ${B[id].name}`, '💡');
      EventBus.instance.emit('mind:learned', { petId: pet.id, text: `${pet.name} aprendió que te encanta que ${B[id].name}` });
      return B[id];
    }
    return null;
  }

  /** Lo que ya sabe que te gusta (para la ficha de estado). */
  learnedBehaviors(pet: Pet): string[] {
    return this.of(pet).learned.filter((id) => B[id]).map((id) => B[id].name);
  }

  // ---------- 2. Tu rutina ----------

  /** Registra que has venido. Devuelve cómo te recibe. */
  onVisit(pet: Pet, now = Clock.now()): { awayH: number; expected: boolean; firstOfDay: boolean } {
    const m = this.of(pet);
    const awayH = m.lastVisit ? (now - m.lastVisit) / 3_600_000 : 0;
    const h = new Date(now).getHours();
    const peak = Math.max(...m.hours);
    const expected = m.visits >= 5 && peak > 0 && m.hours[h] >= peak * 0.6;
    const firstOfDay = !m.lastVisit || new Date(m.lastVisit).toDateString() !== new Date(now).toDateString();
    if (awayH >= 0.5 || !m.lastVisit) {
      for (let i = 0; i < 24; i++) m.hours[i] *= 0.97;
      m.hours[h] += 1;
      m.visits++;
    }
    m.lastVisit = now;
    this.hear(pet, 'hola');
    return { awayH, expected, firstOfDay };
  }

  /** Hora a la que sueles venir (o null si aún no lo sabe). */
  usualHour(pet: Pet): number | null {
    const m = this.of(pet);
    if (m.visits < 5) return null;
    const peak = Math.max(...m.hours);
    return peak > 0 ? m.hours.indexOf(peak) : null;
  }

  // ---------- 3. Gustos ----------

  /** Gusto innato por una comida: estable para cada mascota (no se guarda, se calcula). */
  tasteOf(pet: Pet, foodId: string): Taste {
    const v = hash01(`${pet.id}|${foodId}`);
    return v > 0.72 ? 'love' : v < 0.18 ? 'dislike' : 'like';
  }

  /** La ha comido: devuelve su gusto y si es la primera vez (descubrimiento). */
  onFed(pet: Pet, foodId: string): { taste: Taste; discovered: boolean } {
    const m = this.of(pet);
    const taste = this.tasteOf(pet, foodId);
    const discovered = !m.tasted.includes(foodId);
    if (discovered) {
      m.tasted.push(foodId);
      const name = DataRegistry.instance.getItem(foodId).name.toLowerCase();
      if (taste === 'love') this.remember(pet, `cuando probé ${name} por primera vez`, '😋');
    }
    return { taste, discovered };
  }

  /** Comidas probadas agrupadas por gusto. */
  tastes(pet: Pet): Record<Taste, string[]> {
    const out: Record<Taste, string[]> = { love: [], like: [], dislike: [] };
    for (const id of this.of(pet).tasted) out[this.tasteOf(pet, id)].push(id);
    return out;
  }

  // ---------- 4. Palabras ----------

  /** Oye una palabra. Si ya puede aprenderla, la aprende y lo avisa. */
  hear(pet: Pet, word: string, times = 1): string | null {
    const m = this.of(pet);
    if (m.words.includes(word)) return null;
    m.heard[word] = (m.heard[word] ?? 0) + times;
    const need = pet.data.speciesId === 'parrot' ? WORD_EXPOSURES / 2 : WORD_EXPOSURES;
    if (pet.stage === GrowthStage.Baby || m.heard[word] < need) return null;
    m.words.push(word);
    this.remember(pet, `cuando dije «${word}» por primera vez`, '💬');
    EventBus.instance.emit('mind:word', { petId: pet.id, word });
    return word;
  }

  /** Una acción le enseña su palabra (y su propio nombre, con algo de vínculo). */
  onAction(pet: Pet, actionId: string): string | null {
    const learned = WORD_BY_ACTION[actionId] ? this.hear(pet, WORD_BY_ACTION[actionId]) : null;
    if (learned) return learned;
    if (pet.data.bond >= 10) return this.hear(pet, pet.name);
    return null;
  }

  knows(pet: Pet, word: string): boolean {
    return this.of(pet).words.includes(word);
  }

  // ---------- 5. Recuerdos ----------

  remember(pet: Pet, text: string, icon: string, now = Clock.now()): void {
    const m = this.of(pet);
    if (m.memories.some((x) => x.text === text)) return;
    m.memories.push({ t: now, text, icon });
    if (m.memories.length > MAX_MEMORIES) m.memories.shift();
    // "cuando aprendí X" → "aprendí X" en el diario de hoy
    this.today(pet, now).news.push(text.replace(/^cuando /, ''));
  }

  // ---------- Peticiones y gracias ----------

  /** Si le haces caso a lo que te pidió (en menos de 30 s), te lo agradece. */
  private fulfil(pet: Pet, need: Need, now = Clock.now()): void {
    const m = this.of(pet);
    if (!m.request || m.request.need !== need || now - m.request.at > 30_000) return;
    m.request = null;
    pet.applyDeltas({ happiness: 2 });
    EventBus.instance.emit('mind:say', { petId: pet.id, text: this.say(pet, 'thanks') });
  }

  // ---------- Diario ----------

  /** Registro de hoy (si cambió el día, escribe la página de ayer en el diario). */
  today(pet: Pet, now = Clock.now()): DayLog {
    const m = this.of(pet);
    const key = dayKey(now);
    if (!m.log || m.log.day !== key) {
      if (m.log && (Object.keys(m.log.actions).length || m.log.games.length || m.log.news.length)) {
        m.diary = [...(m.diary ?? []), { day: m.log.day, text: this.writeDiary(pet, m.log) }].slice(-MAX_DIARY);
        EventBus.instance.emit('mind:diary', { petId: pet.id, day: m.log.day, log: m.log });
      }
      m.log = { day: key, actions: {}, foods: [], games: [], news: [] };
    }
    return m.log;
  }

  /** Páginas del diario, la más reciente primero (incluye "hoy, hasta ahora"). */
  diaryPages(pet: Pet, now = Clock.now()): (DiaryEntry & { today?: boolean })[] {
    const log = this.today(pet, now);
    const pages: (DiaryEntry & { today?: boolean })[] = [...(this.of(pet).diary ?? [])].reverse();
    const hasToday = Object.keys(log.actions).length || log.games.length || log.news.length;
    return hasToday ? [{ day: log.day, text: this.writeDiary(pet, log), today: true }, ...pages] : pages;
  }

  /** Sustituye una página por la versión escrita con IA (ver DiaryAI). */
  setDiaryText(pet: Pet, day: string, text: string): void {
    const e = this.of(pet).diary?.find((d) => d.day === day);
    if (e) {
      e.text = text;
      e.ai = true;
    }
  }

  /** Escribe una página en primera persona a partir de lo vivido ese día. */
  writeDiary(pet: Pet, log: DayLog): string {
    const snd = SOUND[pet.data.speciesId] ?? '¡!';
    const a = log.actions;
    const parts: string[] = [];
    if (log.foods.length) {
      const loved = log.foods.filter((f) => this.tastes(pet).love.some((id) => DataRegistry.instance.getItem(id).name.toLowerCase() === f));
      parts.push(`Hoy comí ${list(log.foods)}.${loved.length ? ` ¡${loved[0].charAt(0).toUpperCase()}${loved[0].slice(1)} es lo mejor del mundo!` : ''}`);
    }
    if ((a.pet ?? 0) >= 3) parts.push('Me dieron muchísimos mimos. 🥰');
    else if (a.pet) parts.push('Me acariciaron y me sentí muy querida/o.'.replace('querida/o', pet.data.sex === Sex.Female ? 'querida' : 'querido'));
    if (a.bathe) parts.push('Me bañaron y quedé brillante. ✨');
    if (a.walk) parts.push(a.walk > 1 ? 'Salimos de paseo varias veces. ¡Cuántos olores!' : 'Salimos de paseo. ¡Cuántos olores! 🌳');
    if (a.train) parts.push('Practiqué trucos con mucha concentración. 🎯');
    if (log.games.length) parts.push(`Jugamos a ${list(log.games.map((g) => `«${g}»`))}.`);
    for (const n of log.news.slice(0, 3)) parts.push(`También ${n}.`);
    if (!parts.length) parts.push('Fue un día tranquilo.');
    const close = pet.data.bond >= 60 ? 'Te quiero muchísimo. 💞' : pet.data.bond >= 20 ? 'Me gusta mucho estar contigo. 💕' : 'Mañana quiero jugar más contigo.';
    if (pet.stage === GrowthStage.Baby) return `${snd} ${snd}… (${parts.join(' ')} ${close})`;
    return `${parts.join(' ')} ${close}`;
  }

  // ---------- Habla ----------

  /**
   * Qué dice ahora. Depende de la etapa (los bebés solo hacen ruiditos) y de las palabras que sabe.
   * Contextos: greet, greet-expected, greet-missed, hungry, dirty, bored, tired, happy, head, belly, dizzy,
   * love-food, dislike-food, memory, learned, night.
   */
  say(pet: Pet, ctx: string): string {
    const m = this.of(pet);
    const snd = SOUND[pet.data.speciesId] ?? '¡!';
    const k = (w: string) => m.words.includes(w);
    const name = k(pet.name) ? pet.name : '';
    const talks = pet.stage !== GrowthStage.Baby && m.words.length >= 3;
    if (pet.stage === GrowthStage.Baby) {
      const baby: Record<string, string[]> = {
        hungry: [`${snd} 🍼`, `${snd.replace('!', '…')} 🥺🍼`, '*se chupa la patita* 🍼'], dirty: [`${snd} 🫧`, '*se rasca* 🫧'],
        bored: [`${snd} 🎾`, `¡${snd.replace(/[¡!]/g, '')} ${snd.replace(/[¡!]/g, '').toLowerCase()}! 🎾`], tired: [`${snd.replace('!', '…')} 💤`, '*bosteza* 💤'],
        head: [`${snd} 💕`, '*cierra los ojitos* 💕'], belly: [`¡Ji ji! ${snd}`, '*patalea feliz* 😆'], dizzy: ['@_@'],
        'love-food': ['¡Ñam ñam! 😋'], 'dislike-food': ['¡Puaj! 😖'], thanks: [`${snd} 💕`, '*te da un lametón* 💕'],
      };
      return pick(baby[ctx] ?? [`${snd} ✨`, '*te mira con ojitos brillantes* ✨', `${snd} 💛`]);
    }
    const opts: string[] = [];
    switch (ctx) {
      case 'greet-expected':
        opts.push(talks ? `¡${k('hola') ? 'Hola' : snd}! ¡Sabía que vendrías a esta hora! 💞` : `${snd} ${snd} ⏰💞`);
        break;
      case 'greet-missed':
        opts.push(talks ? `¡Te eché mucho de menos! 🥺💞` : `${snd}… 🥺💞`);
        break;
      case 'greet':
        opts.push(k('hola') ? `¡Hola! ${snd}` : `${snd} 👋`);
        break;
      case 'hungry':
        if (k('comida')) opts.push(...(talks ? ['¿Hay comida? Tengo hambre… 🥺', 'Mi tripita hace ruidos… 🍖', '¿Comemos algo? 😋'] : [`¿Comida? ${snd}`, '¡Comida, comida! 🍖']));
        else opts.push(`${snd} 🍖`, '*mira su cuenco vacío* 🥺', `${snd.replace('!', '…')} 🍖`);
        break;
      case 'dirty':
        if (k('baño')) opts.push(...(talks ? ['Creo que necesito un baño… 🫧', 'Huelo un poquito raro… 🫧'] : ['¿Baño? 🫧']));
        else opts.push(`${snd} 🫧`, '*se rasca la oreja* 🫧');
        break;
      case 'bored':
        opts.push(k('pelota') ? (talks ? '¿Jugamos con la pelota? 🎾' : `¡Pelota! ${snd}`) : `${snd} 🎾`);
        if (k('paseo')) opts.push(talks ? '¿Y si damos un paseo? 🌳' : '¿Paseo? 🌳');
        break;
      case 'tired':
        opts.push(talks ? 'Tengo sueñito… 💤' : `${snd.replace('!', '…')} 💤`);
        break;
      case 'happy':
        opts.push(`${snd} 💕`);
        if (talks) opts.push(name ? `¡Soy ${name} y soy muy feliz! ✨` : '¡Qué feliz soy! ✨', pet.data.bond >= 60 ? '¡Te quiero mucho! 💞' : '¡Me gusta estar contigo! 💕');
        if (k('mimos')) opts.push('¿Más mimos? 🥰');
        break;
      case 'head':
        opts.push(k('mimos') ? '¡Mimos! 🥰' : `${snd} 💕`, '¡Más, más! 💕');
        break;
      case 'belly':
        opts.push('¡Ji ji ji! ¡Cosquillas! 😆', `¡Ja ja! ${snd}`);
        break;
      case 'dizzy':
        opts.push('¡Me mareo! @_@', '¡Ay, ay! 😵‍💫');
        break;
      case 'love-food':
        opts.push(talks ? '¡Me encanta! ¡Es mi favorita! 😋' : '¡Ñam ñam! 😋');
        break;
      case 'dislike-food':
        opts.push(talks ? 'Mmm… esto no me gusta mucho 😖' : '¡Puaj! 😖');
        break;
      case 'night':
        opts.push(talks ? 'Ya es de noche… ¿dormimos? 🌙' : `${snd.replace('!', '…')} 🌙`);
        break;
      case 'learned':
        opts.push(talks ? '¡Ya sé lo que te gusta! 💡' : `${snd} 💡`);
        break;
      case 'thanks':
        opts.push(talks ? '¡Gracias por hacerme caso! 💕' : `¡${snd.replace(/[¡!]/g, '')}! 💕`, talks ? '¡Eres la mejor persona del mundo! 🥰' : `${snd} 🥰`);
        break;
      case 'time': {
        const h = new Date(Clock.now()).getHours();
        if (talks) opts.push(h < 12 ? '¡Buenos días! ☀️' : h < 20 ? '¡Qué buena tarde hace! 🌤️' : '¡Buenas noches! 🌙');
        else opts.push(`${snd} ${h < 12 ? '☀️' : h < 20 ? '🌤️' : '🌙'}`);
        break;
      }
      case 'trait':
        opts.push(...this.traitLines(pet, talks, snd));
        break;
      case 'fav': {
        const fav = this.tastes(pet).love[0];
        if (fav && talks) opts.push(`Sueño con ${DataRegistry.instance.getItem(fav).name.toLowerCase()}… 😋`);
        else opts.push(`${snd} 😋`);
        break;
      }
      case 'again': {
        const id = m.learned[Math.floor(Math.random() * m.learned.length)];
        if (id && B[id] && talks) opts.push(`¿Quieres que ${B[id].name} otra vez? 😊`);
        else opts.push(`${snd} ✨`);
        break;
      }
      case 'memory': {
        const mem = this.recall(pet);
        if (mem && talks) opts.push(`¿Te acuerdas de ${mem.text}? ${mem.icon}`);
        else opts.push(`${snd} ✨`);
        break;
      }
      default:
        opts.push(`${snd} ✨`);
    }
    return pick(opts);
  }

  /** Frases según su carácter (rasgos). */
  private traitLines(pet: Pet, talks: boolean, snd: string): string[] {
    const f = pet.data.sex === Sex.Female;
    const lines: Record<string, string[]> = {
      gloton: ['¿Ya es hora de comer? Pregunto por nada… 🍪', '¡Huele a algo rico! 👃'],
      dormilon: ['Una siestecita no me vendría mal… 😴', '¿Sabías que dormir es mi deporte favorito? 💤'],
      jugueton: ['¡Tengo ganas de correr! 🎾', '¡Juguemos a algo! ¡Lo que sea! ⚡'],
      timido: ['Eh… hola… 👉👈', 'Contigo ya no me da tanta vergüenza… 🙈'],
      curioso: ['¿Qué hay detrás de la ventana? 🔍', '¿Por qué el cielo es azul? 🤔'],
      carinoso: ['¿Un abrazo? 🤗', '¡Eres mi persona favorita! 💕'],
      presumido: [`¿A que hoy estoy ${f ? 'guapísima' : 'guapísimo'}? ✨`, '¿Me sacas una foto? 📸'],
    };
    const out = pet.data.traits.flatMap((t) => lines[t] ?? []);
    return talks && out.length ? out : [`${snd} ✨`];
  }

  /** Un recuerdo al azar (los más recientes, más probables). */
  recall(pet: Pet): PetMemory | null {
    const mems = this.of(pet).memories;
    if (!mems.length) return null;
    const i = Math.floor(mems.length * Math.sqrt(Math.random()));
    return mems[Math.min(i, mems.length - 1)];
  }

  /**
   * ¿Qué le apetece decir por iniciativa propia? Si es una petición (comer, bañarse, jugar),
   * devuelve `need`: tocar el bocadillo lo atiende, y si le haces caso te da las gracias.
   */
  chatter(pet: Pet, now = Clock.now()): { text: string; need?: Need } | null {
    const s = pet.stats;
    const m = this.of(pet);
    const h = new Date(now).getHours();
    const ask = (ctx: string, need: Need) => {
      // No insiste: si ya lo pidió hace poco, espera (como mucho una petición cada 25 s)
      if (m.request && now - m.request.at < 25_000) return null;
      m.request = { need, at: now };
      return { text: this.say(pet, ctx), need };
    };
    if (s.hunger > 70) return ask('hungry', 'feed');
    if (s.hygiene < 30) return ask('dirty', 'bathe');
    if (s.energy < 25) return { text: this.say(pet, 'tired') };
    if (s.happiness < 45 && s.energy > 30) return ask('bored', 'play');
    if (h >= 22 || h < 6) return { text: this.say(pet, 'night') };
    const r = Math.random();
    if (r < 0.2 && m.memories.length > 0 && pet.data.bond >= 20) return { text: this.say(pet, 'memory') };
    if (r < 0.4) return { text: this.say(pet, 'trait') };
    if (r < 0.5 && m.learned.length) return { text: this.say(pet, 'again') };
    if (r < 0.58 && this.tastes(pet).love.length) return { text: this.say(pet, 'fav') };
    if (r < 0.68) return { text: this.say(pet, 'time') };
    return { text: this.say(pet, 'happy') };
  }

  /** Resumen para la ficha de estado. */
  summary(pet: Pet): { words: string[]; learned: string[]; usualHour: number | null; tastes: Record<Taste, string[]> } {
    return { words: [...this.of(pet).words], learned: this.learnedBehaviors(pet), usualHour: this.usualHour(pet), tastes: this.tastes(pet) };
  }
}
