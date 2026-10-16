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
import { GrowthStage } from './PetTypes';

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
}

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
    });
    bus.on('trick:learned', ({ petId, trickId }) => {
      const pet = PetManager.instance.get(petId);
      const trick = pet?.species.tricks.find((t) => t.id === trickId);
      if (pet && trick) this.remember(pet, `cuando aprendí «${trick.name.toLowerCase()}»`, trick.icon);
    });
    bus.on('competition:finished', ({ petId, rating }) => {
      const pet = PetManager.instance.get(petId);
      if (pet && rating >= 4) this.remember(pet, `cuando saqué ${rating} estrellas en una competencia`, '🏆');
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
      const baby: Record<string, string> = {
        hungry: `${snd} 🍼`, dirty: `${snd} 🫧`, bored: `${snd} 🎾`, tired: `${snd.replace('!', '…')} 💤`,
        head: `${snd} 💕`, belly: `¡Ji ji! ${snd}`, dizzy: '@_@', 'love-food': `¡Ñam ñam! 😋`, 'dislike-food': '¡Puaj! 😖',
      };
      return baby[ctx] ?? `${snd} ✨`;
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
        opts.push(k('comida') ? (talks ? '¿Hay comida? Tengo hambre… 🥺' : `¿Comida? ${snd}`) : `${snd} 🍖`);
        break;
      case 'dirty':
        opts.push(k('baño') ? (talks ? 'Creo que necesito un baño… 🫧' : `¿Baño? 🫧`) : `${snd} 🫧`);
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

  /** Un recuerdo al azar (los más recientes, más probables). */
  recall(pet: Pet): PetMemory | null {
    const mems = this.of(pet).memories;
    if (!mems.length) return null;
    const i = Math.floor(mems.length * Math.sqrt(Math.random()));
    return mems[Math.min(i, mems.length - 1)];
  }

  /** ¿Qué le apetece decir por iniciativa propia ahora? (null = nada) */
  chatter(pet: Pet, now = Clock.now()): string | null {
    const s = pet.stats;
    const h = new Date(now).getHours();
    if (s.hunger > 70) return this.say(pet, 'hungry');
    if (s.hygiene < 30) return this.say(pet, 'dirty');
    if (s.energy < 25 || (h >= 22 || h < 6)) return this.say(pet, s.energy < 25 ? 'tired' : 'night');
    if (s.happiness < 45) return this.say(pet, 'bored');
    if (Math.random() < 0.35 && this.of(pet).memories.length > 0 && pet.data.bond >= 20) return this.say(pet, 'memory');
    return this.say(pet, 'happy');
  }

  /** Resumen para la ficha de estado. */
  summary(pet: Pet): { words: string[]; learned: string[]; usualHour: number | null; tastes: Record<Taste, string[]> } {
    return { words: [...this.of(pet).words], learned: this.learnedBehaviors(pet), usualHour: this.usualHour(pet), tastes: this.tastes(pet) };
  }
}
