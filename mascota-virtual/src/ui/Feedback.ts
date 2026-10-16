/**
 * Sonido y vibración (Auditoría P7). Los sonidos se sintetizan con WebAudio: no hay archivos
 * de audio que cargar ni licencias. La vibración usa @capacitor/haptics (en web, navigator.vibrate).
 * Se pueden desactivar en Ajustes (GameState.settings).
 */
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { GameState } from '../core/GameState';

export type SoundId = 'tap' | 'eat' | 'pet' | 'bubble' | 'splash' | 'coin' | 'level' | 'happy' | 'error' | 'camera' | 'jump' | 'hurt' | 'land' | 'fever';

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Una nota con envolvente suave. */
function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; to?: number; delay?: number } = {}): void {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + (opts.delay ?? 0);
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.12, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Ruido filtrado (agua, cámara). */
function noise(dur: number, freq: number, gain = 0.08): void {
  const a = audio();
  if (!a) return;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  const f = a.createBiquadFilter();
  const g = a.createGain();
  src.buffer = buf;
  f.type = 'bandpass';
  f.frequency.value = freq;
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

const SOUNDS: Record<SoundId, () => void> = {
  tap: () => tone(880, 0.05, { gain: 0.04 }),
  eat: () => { tone(320, 0.08, { type: 'triangle' }); tone(260, 0.08, { type: 'triangle', delay: 0.12 }); },
  pet: () => { tone(220, 0.35, { type: 'triangle', gain: 0.06, to: 260 }); },
  bubble: () => tone(500, 0.09, { to: 1100, gain: 0.07 }),
  splash: () => noise(0.35, 1400, 0.12),
  coin: () => { tone(988, 0.08, { type: 'square', gain: 0.05 }); tone(1319, 0.18, { type: 'square', gain: 0.05, delay: 0.08 }); },
  level: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: 'triangle', delay: i * 0.11 })),
  happy: () => { tone(660, 0.1, { type: 'triangle' }); tone(880, 0.16, { type: 'triangle', delay: 0.1 }); },
  error: () => tone(180, 0.18, { type: 'sawtooth', gain: 0.05 }),
  camera: () => noise(0.12, 3000, 0.1),
  jump: () => tone(330, 0.16, { type: 'triangle', to: 660, gain: 0.08 }),
  hurt: () => { tone(200, 0.2, { type: 'square', to: 90, gain: 0.06 }); noise(0.15, 500, 0.08); },
  land: () => noise(0.06, 700, 0.06),
  fever: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.12, { type: 'square', gain: 0.04, delay: i * 0.06 })),
};

/** Nota de acierto que sube de tono con el combo (escala mayor). */
export function blip(n: number): void {
  if (!settings().sound) return;
  const scale = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19];
  const step = scale[Math.min(n - 1, scale.length - 1)] ?? 0;
  try {
    tone(523 * Math.pow(2, step / 12), 0.09, { type: 'triangle', gain: 0.08 });
  } catch {
    /* sin audio */
  }
}

function settings() {
  return GameState.instance.data.settings;
}

/** Reproduce un sonido (si el jugador no lo ha desactivado). */
export function play(id: SoundId): void {
  if (!settings().sound) return;
  try {
    SOUNDS[id]();
  } catch {
    /* sin audio: no pasa nada */
  }
}

/** Vibración corta: 'light' para toques, 'success' para premios, 'error' para fallos. */
export function vibrate(kind: 'light' | 'medium' | 'success' | 'error' = 'light'): void {
  if (!settings().haptics) return;
  const p =
    kind === 'success' ? Haptics.notification({ type: NotificationType.Success })
    : kind === 'error' ? Haptics.notification({ type: NotificationType.Error })
    : Haptics.impact({ style: kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light });
  p.catch(() => undefined);
}

/** Sonido + vibración juntos (lo normal al premiar una acción). */
export function feedback(id: SoundId, kind: Parameters<typeof vibrate>[0] = 'light'): void {
  play(id);
  vibrate(kind);
}
