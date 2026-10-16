import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Versión de la app para las estadísticas anónimas (la misma que ve Google Play)
const gradle = readFileSync(new URL('./android/app/build.gradle', import.meta.url), 'utf8');
process.env.VITE_APP_VERSION ??= gradle.match(/versionName "([\d.]+)"/)?.[1] ?? 'web';

export default defineConfig({
  // Rutas relativas para que funcione dentro del WebView de Android (Capacitor)
  base: './',
  build: { outDir: 'dist', target: 'es2020' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
