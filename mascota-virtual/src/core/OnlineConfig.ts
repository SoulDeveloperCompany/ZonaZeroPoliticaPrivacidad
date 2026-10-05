/**
 * Configuración del servidor (Google Sheets + Apps Script, ver server/LEEME.md).
 * Pega aquí la URL /exec para que venga puesta de serie en el APK.
 * El jugador también puede ponerla en Ajustes › Servidor (tiene prioridad).
 */
export const OnlineConfig = {
  DEFAULT_URL: '',
  /** Cada cuánto se sincroniza mientras la app está abierta. */
  SYNC_EVERY_MS: 3 * 60 * 1000,
  TIMEOUT_MS: 15_000,
};
