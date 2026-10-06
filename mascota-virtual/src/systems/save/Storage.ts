/**
 * Almacenamiento clave-valor intercambiable:
 *  - Android/iOS: Capacitor Preferences (persistente y fiable).
 *  - Navegador: localStorage.
 *  - Tests: memoria.
 */
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export interface KeyValueStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();
  async get(key: string) {
    return this.map.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.map.set(key, value);
  }
  async remove(key: string) {
    this.map.delete(key);
  }
}

class BrowserStorage implements KeyValueStorage {
  async get(key: string) {
    return localStorage.getItem(key);
  }
  async set(key: string, value: string) {
    localStorage.setItem(key, value);
  }
  async remove(key: string) {
    localStorage.removeItem(key);
  }
}

class NativeStorage implements KeyValueStorage {
  async get(key: string) {
    return (await Preferences.get({ key })).value;
  }
  async set(key: string, value: string) {
    await Preferences.set({ key, value });
  }
  async remove(key: string) {
    await Preferences.remove({ key });
  }
}

/** Elige el almacenamiento adecuado para la plataforma actual. */
export function createDefaultStorage(): KeyValueStorage {
  if (Capacitor.isNativePlatform()) return new NativeStorage();
  if (typeof localStorage !== 'undefined') return new BrowserStorage();
  return new MemoryStorage();
}
