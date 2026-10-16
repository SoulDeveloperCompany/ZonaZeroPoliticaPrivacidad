/**
 * Punto de entrada: arranca la lógica del juego y después la interfaz.
 */
// Fuente Nunito empaquetada (antes dependía de que el móvil la tuviera: casi nunca)
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-900.css';
import './ui/styles.css';
import { GameManager } from './core/GameManager';
import { App } from './ui/App';

async function boot(): Promise<void> {
  const report = await GameManager.instance.start();
  new App(document.getElementById('app')!).start(report);
  document.getElementById('splash')?.remove();
}

boot().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<div style="padding:24px;font-family:sans-serif">Error al iniciar el juego 😿<pre>${String(err)}</pre></div>`;
});
