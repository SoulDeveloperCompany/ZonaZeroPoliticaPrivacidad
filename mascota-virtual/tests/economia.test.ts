/**
 * Simulador de economía (Auditoría P10): `npm run -s economia`
 * Con los datos REALES del juego (tienda, decoración, minijuegos, misiones, recompensa diaria)
 * calcula cuánto ganan al día un jugador activo y uno casual, y cuánto tardan en completar las metas.
 * Además comprueba los objetivos de diseño: que las metas duren semanas y que las estrellas tengan destino.
 */
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GameConfig } from '../src/core/GameConfig';
import { DataRegistry } from '../src/data/DataRegistry';
import { PLAY_GAMES } from '../src/data/games';
import { MISSIONS, MISSION_BONUS } from '../src/data/missions';

const items = DataRegistry.instance.allItems();
const suma = (f: (i: (typeof items)[number]) => boolean, k: 'coins' | 'stars') =>
  items.filter(f).reduce((t, i) => t + (i.price[k] ?? 0), 0);

// Sumideros permanentes (lo que se compra una vez)
const decorMonedas = suma((i) => i.category === 'decor', 'coins');
const decorEstrellas = suma((i) => i.category === 'decor', 'stars');
const accMonedas = suma((i) => i.category === 'accessory', 'coins');
const accEstrellas = suma((i) => i.category === 'accessory', 'stars');
const mueblesMonedas = suma((i) => i.category === 'furniture', 'coins');
const mueblesEstrellas = suma((i) => i.category === 'furniture', 'stars');
const metaMonedas = decorMonedas + accMonedas + mueblesMonedas;
const metaEstrellas = decorEstrellas + accEstrellas + mueblesEstrellas;

// Ingresos diarios (jugador ya adulto)
const cfg = GameConfig.DAILY_BONUS;
const diariaMedia = (Array.from({ length: cfg.maxStreak }, (_, i) => cfg.baseCoins + cfg.streakCoins * i).reduce((a, b) => a + b, 0)) / cfg.maxStreak;
const misionMedia = MISSIONS.reduce((t, m) => t + m.reward, 0) / MISSIONS.length;
const topeMinijuegos = PLAY_GAMES.reduce((t, g) => t + g.dailyCoinCap, 0);

const perfiles = {
  // Activo: entra cada día, hace las 3 misiones, llega al tope de minijuegos y 2 competencias (neto ~40 c/u)
  activo: { monedas: diariaMedia + misionMedia * 3 + MISSION_BONUS.coins + topeMinijuegos + 2 * 40 + 15, estrellas: 1 / 7 + MISSION_BONUS.stars + 0.5 },
  // Casual: entra 5 de 7 días, 2 misiones, la mitad del tope de minijuegos, sin competir
  casual: { monedas: (5 / 7) * (diariaMedia * 0.8 + misionMedia * 2 + topeMinijuegos * 0.5 + 8), estrellas: (5 / 7) * 0.4 },
};

describe('Economía (simulador)', () => {
  it('las metas de compra duran semanas y las estrellas tienen destino', () => {
    const dias = (n: number, porDia: number) => Math.ceil(n / porDia);
    const res = {
      ingresos: { activo: Math.round(perfiles.activo.monedas), casual: Math.round(perfiles.casual.monedas) },
      metas: { monedas: metaMonedas, estrellas: metaEstrellas, decoracion: decorMonedas, accesorios: accMonedas, muebles: mueblesMonedas },
      diasHastaComprarTodo: {
        activo: dias(metaMonedas, perfiles.activo.monedas),
        casual: dias(metaMonedas, perfiles.casual.monedas),
      },
      diasHastaGastarEstrellas: {
        activo: dias(metaEstrellas, perfiles.activo.estrellas),
        casual: dias(metaEstrellas, perfiles.casual.estrellas),
      },
    };
    writeFileSync(new URL('../artifact/economia.json', import.meta.url), JSON.stringify(res, null, 2));
    // Objetivos de diseño (docs/AUDITORIA-2026-10.md, P10)
    expect(res.diasHastaComprarTodo.activo).toBeGreaterThanOrEqual(14);
    expect(res.diasHastaComprarTodo.casual).toBeGreaterThanOrEqual(28);
    expect(res.diasHastaGastarEstrellas.activo).toBeGreaterThanOrEqual(21);
  });
});
