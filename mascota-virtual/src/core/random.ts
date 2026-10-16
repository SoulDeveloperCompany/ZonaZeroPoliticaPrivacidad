/** Utilidades de aleatoriedad. Se puede sustituir `rng` en tests para resultados deterministas. */

export let rng: () => number = Math.random;

export function setRng(fn: () => number): void {
  rng = fn;
}

/** RNG determinista (mulberry32) para tests o semillas. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function randRange(min: number, max: number): number {
  return rng() * (max - min) + min;
}

export function pick<T>(list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)];
}

export function chance(p: number): boolean {
  return rng() < p;
}

export function clamp(v: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, v));
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(rng() * 1e9).toString(36)}`;
}
