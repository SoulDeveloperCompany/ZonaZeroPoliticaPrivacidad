/**
 * Constantes de balance del juego. Centralizadas aquí para poder
 * ajustar la dificultad sin tocar la lógica de los sistemas.
 */
export const GameConfig = {
  /** 1 hora real = 1 día de juego. */
  REAL_MS_PER_GAME_DAY: 60 * 60 * 1000,

  /** Paso máximo de simulación (en días de juego) para que el cálculo offline sea preciso. */
  SIMULATION_STEP_DAYS: 0.05,

  /** Máximo de tiempo offline que se simula (en ms reales). */
  MAX_OFFLINE_MS: 14 * 24 * 60 * 60 * 1000,

  /** Multiplicador de degradación mientras el jugador no está (más amable que en vivo). */
  OFFLINE_DECAY_FACTOR: 0.6,

  /**
   * Cambio de stats por DÍA de juego (= 1 hora real).
   * Valores positivos suben el stat, negativos lo bajan.
   */
  DECAY_PER_DAY: {
    hunger: 12, // el hambre sube
    happiness: -8,
    energy: -7,
    hygiene: -7,
  },

  /**
   * Rutina de sueño autónoma: la mascota decide sola cuándo dormir.
   * Con energía baja le entra sueño y se duerme; se despierta sola al
   * descansar. Si el jugador la despierta, pierde felicidad.
   */
  SLEEP: {
    energyPerDay: 45,
    decayMultiplier: 0.4,
    /** Por debajo de esta energía se duerme seguro. */
    autoSleepEnergy: 20,
    /** Entre autoSleep y esto tiene sueño y puede dormirse en cualquier momento. */
    drowsyEnergy: 40,
    /** Probabilidad (por día de juego) de dormirse cuando tiene sueño. */
    drowsyChancePerDay: 3,
    autoWakeEnergy: 95,
    /** Felicidad que pierde si la despiertan. */
    wakePenalty: 10,
    /** Tras despertarla, aguanta despierta este tiempo (salvo agotamiento total). */
    wokenGraceMs: 10 * 60 * 1000,
  },

  /** Reglas de salud (por día de juego). */
  HEALTH: {
    hungerThreshold: 80,
    hungerDamage: 15,
    hygieneThreshold: 20,
    hygieneDamage: 10,
    happinessThreshold: 15,
    happinessDamage: 6,
    energyThreshold: 5,
    energyDamage: 5,
    regenPerDay: 5,
  },

  /** Escape: tiempo para recuperar a la mascota y probabilidades de búsqueda. */
  ESCAPE: {
    recoveryWindowMs: 48 * 60 * 60 * 1000,
    searchCooldownMs: 15 * 60 * 1000,
    baseSearchChance: 0.25,
    searchChancePerAttempt: 0.15,
  },

  /** Crecimiento. */
  GROWTH: {
    /** Cuidado medio (0-100) necesario en etapas tempranas para el bonus. */
    wellCaredThreshold: 70,
    /** Bonus a los stats base del adulto si fue bien cuidado. */
    wellCaredBonus: 0.1,
    boostMultiplier: 2,
  },

  /** Bañarla cuando ya está limpia (higiene >= umbral) la resfría. */
  COLD: { hygieneThreshold: 80, healthDamage: 12, happinessDamage: 4 },

  /** Mascotas activas simultáneas; las demás van al rancho. */
  MAX_ACTIVE_PETS: 3,

  /** Probabilidad de encontrar monedas al interactuar. */
  COIN_FIND_CHANCE: 0.2,

  /** Recompensa diaria. */
  DAILY_BONUS: { baseCoins: 100, streakCoins: 20, maxStreak: 7, starOnDay: 7 },

  /** Crianza. */
  BREEDING: {
    cooldownDays: 6,
    minHappiness: 50,
    minHealth: 60,
    npcPartnerFee: 120,
    mutationChance: 0.1,
  },

  /** Adopción pública: tiempo (ms reales) hasta que alguien adopta la cría publicada. */
  ADOPTION_WAIT_MS: 10 * 60 * 1000,

  /** Guardado automático (ms). */
  AUTOSAVE_MS: 10_000,

  STARTING_COINS: 300,
  STARTING_STARS: 3,
} as const;
