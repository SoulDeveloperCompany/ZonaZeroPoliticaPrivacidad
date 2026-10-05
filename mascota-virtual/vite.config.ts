import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Rutas relativas para que funcione dentro del WebView de Android (Capacitor)
  base: './',
  build: { outDir: 'dist', target: 'es2020' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
