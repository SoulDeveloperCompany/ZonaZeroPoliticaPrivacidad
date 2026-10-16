/**
 * Música ambiental generativa (WebAudio, sin archivos ni licencias): una nana suave en Do mayor
 * (Do – La m – Fa – Sol) con melodía pentatónica que cambia cada pocas frases, para que no canse.
 * Arranca con el primer toque (los navegadores no dejan sonar antes), se pausa al salir de la app
 * y se apaga en Ajustes › Música.
 */
import { GameState } from '../core/GameState';

const BPM = 80;
const BEAT = 60 / BPM;
// Acordes (notas MIDI): Do, La m, Fa, Sol
const CHORDS = [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]];
const PENTA = [60, 62, 64, 67, 69, 72, 74, 76];
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let nextTime = 0;
let step = 0;
let phrase: (number | null)[] = [];
let started = false;

export function musicEnabled(): boolean {
  return GameState.instance.data.settings.music !== false;
}

function note(freq: number, t: number, dur: number, gain: number, type: OscillatorType): void {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** Frase de 4 compases (16 tiempos): paseo suave por la pentatónica con silencios. */
function newPhrase(): (number | null)[] {
  const out: (number | null)[] = [];
  let i = 3;
  for (let b = 0; b < 16; b++) {
    if (b % 4 !== 0 && Math.random() < 0.3) {
      out.push(null);
      continue;
    }
    i = Math.max(0, Math.min(PENTA.length - 1, i + Math.round((Math.random() - 0.5) * 3)));
    out.push(PENTA[i]);
  }
  return out;
}

function schedule(): void {
  if (!ctx) return;
  while (nextTime < ctx.currentTime + 0.4) {
    const bar = Math.floor(step / 4) % 4;
    const beat = step % 4;
    if (step % 32 === 0) phrase = newPhrase(); // nueva melodía cada 2 vueltas
    const chord = CHORDS[bar];
    if (beat === 0) {
      note(midi(chord[0] - 12), nextTime, BEAT * 3.6, 0.05, 'triangle'); // bajo
      chord.forEach((n) => note(midi(n), nextTime, BEAT * 3.8, 0.018, 'sine')); // colchón
    }
    const m = phrase[step % 16];
    if (m) note(midi(m), nextTime, BEAT * 0.9, 0.035, 'sine');
    nextTime += BEAT;
    step++;
  }
}

/** Empieza a sonar (o reanuda) si está activada. */
export function startMusic(): void {
  if (!musicEnabled() || timer) return;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    if (!master) {
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    nextTime = ctx.currentTime + 0.1;
    timer = setInterval(schedule, 120);
  } catch {
    /* sin audio */
  }
}

export function stopMusic(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Engancha la música al primer toque y la pausa cuando la app pasa a segundo plano. */
export function setupMusic(): void {
  if (started || typeof document === 'undefined') return;
  started = true;
  const first = () => {
    startMusic();
    document.removeEventListener('pointerdown', first);
  };
  document.addEventListener('pointerdown', first);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') stopMusic();
    else startMusic();
  });
}

/** Baja la música mientras hay un minijuego (para oír bien los efectos). */
export function duckMusic(on: boolean): void {
  if (master && ctx) master.gain.setTargetAtTime(on ? 0.35 : 0.9, ctx.currentTime, 0.3);
}
