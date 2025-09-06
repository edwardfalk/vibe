// Configuration for Vibe game (moved to @vibe/core)

// Conditionally load dotenv only in a real Node.js environment (avoid bundler shims)
const isRealNode =
  typeof process !== 'undefined' &&
  !!(process && process.env) &&
  !!(process.versions && process.versions.node);

try {
  if (isRealNode) {
    // Load .env in Node context for local dev – ignored in browser
    // Note: dynamic import remains async; CONFIG readers use getters to observe updated values
    import('dotenv')
      .then((dotenv) => {
        const dot = dotenv.default || dotenv;
        if (typeof dot.config === 'function') {
          dot.config();
        }
      })
      .catch(() => {
        /* Ignore if dotenv fails to load */
      });
  }
} catch (_) {
  /* Ignore if environment probing fails (e.g., strict CSP) */
}

function getEnv(name, fallback) {
  try {
    if (typeof process !== 'undefined' && process.env && name in process.env) {
      const value = process.env[name];
      return value == null ? fallback : value;
    }
  } catch (_) {
    /* ignore */
  }
  return fallback;
}

function validateEnvironment() {
  const warnings = [];
  const errors = [];

  if (!getEnv('GITHUB_TOKEN', '')) {
    warnings.push(
      'GITHUB_TOKEN not set - GitHub API requests will be rate limited'
    );
  } else if (getEnv('GITHUB_TOKEN', '').length < 20) {
    errors.push('GITHUB_TOKEN appears to be invalid (too short)');
  }

  // Ticket API removed – no port validation required.

  const devPort = parseInt(getEnv('DEV_SERVER_PORT', ''));
  if (isNaN(devPort) || devPort < 1000 || devPort > 65535) {
    warnings.push(
      `Invalid DEV_SERVER_PORT: ${getEnv('DEV_SERVER_PORT', '')}, using default 5500`
    );
  }

  warnings.forEach((warning) => console.warn(`⚠️ ${warning}`));
  errors.forEach((error) => console.error(`❌ ${error}`));

  if (errors.length > 0) {
    throw new Error(`Environment validation failed: ${errors.join(', ')}`);
  }

  return { warnings: warnings.length, errors: errors.length };
}

const CONFIG = {
  GITHUB: {
    get TOKEN() {
      return getEnv('GITHUB_TOKEN', null);
    },
    API_URL: 'https://api.github.com',
    OWNER: 'edwardfalk',
    REPO: 'vibe',
    RATE_LIMIT: {
      MAX_RETRIES: 3,
      RETRY_DELAY: 1000,
    },
  },
  // Ticket API removed – see docs/tickets/ for Markdown-based tasks.
  DEV_SERVER: {
    get PORT() {
      const raw = getEnv('DEV_SERVER_PORT', '');
      const v = Number(raw);
      return Number.isInteger(v) && v >= 1000 && v <= 65535 ? v : 5500;
    },
  },
  CODERABBIT: {
    get AUTO_TICKETS() {
      return getEnv('CODERABBIT_AUTO_TICKETS', '') === 'true';
    },
    get REVIEW_THRESHOLD() {
      return getEnv('CODERABBIT_REVIEW_THRESHOLD', 'high');
    },
    MAX_SUGGESTIONS: 50,
  },
  SECURITY: {
    get NODE_ENV() {
      return getEnv('NODE_ENV', 'development');
    },
    get LOG_LEVEL() {
      return getEnv('LOG_LEVEL', 'info');
    },
  },
  PATHS: {
    BUG_REPORTS: 'tests/bug-reports',
    SCREENSHOTS: 'tests/screenshots',
    LOGS: 'logs',
  },
  get GOOGLE_CLOUD_TTS_API_KEY() {
    return getEnv('GOOGLE_CLOUD_TTS_API_KEY', '');
  },
  TTS_SETTINGS: {
    USE_CLOUD_TTS: false,
    TTS_VOLUME: 0.6,
    ENABLE_AUDIO_EFFECTS: true,
    ENABLE_AUDIO_CACHE: true,
  },
  AUDIO: {
    COMPRESSOR: {
      THRESHOLD: -24,
      KNEE: 30,
      RATIO: 12,
    },
  },
  GAME_SETTINGS: {
    get BPM() {
      const raw = getEnv('GAME_BPM', '');
      const v = Number(raw);
      return Number.isFinite(v) && v > 40 && v < 300 ? v : 120; // default 120 BPM
    },
    DEBUG_MODE: false,
    DEBUG_COLLISIONS: false,
    WORLD_WIDTH: 1150,
    WORLD_HEIGHT: 850,
    ENABLE_ELITE_ENEMIES: false,
    SPEECH_FREQUENCY: {
      MIN: 5,
      MAX: 15,
    },
  },
  SPEECH_SETTINGS: {
    DEFAULT: { AMBIENT_MIN: 5, AMBIENT_MAX: 15, COOLDOWN: 10 },
    GRUNT: { AMBIENT_MIN: 3, AMBIENT_MAX: 8, COOLDOWN: 4 },
    TANK: { AMBIENT_MIN: 8, AMBIENT_MAX: 20, COOLDOWN: 12 },
    RUSHER: { AMBIENT_MIN: 4, AMBIENT_MAX: 10, COOLDOWN: 6 },
    STABBER: {
      AMBIENT_MIN: 6,
      AMBIENT_MAX: 14,
      COOLDOWN: 8,
      CHANT_MIN: 3,
      CHANT_MAX: 6,
    },
  },
  SPEECH_VOLUMES: {
    PLAYER: 0.5,
    GRUNT: 0.45,
    RUSHER: 0.55,
    TANK: 0.4,
    STABBER: 0.7,
  },
  STABBER_SETTINGS: {
    MIN_STAB_DISTANCE: 200,
    MAX_STAB_DISTANCE: 350,
    MAX_PREPARE_TIME: 45,
    MAX_WARNING_TIME: 40,
  },
};

const validation = { warnings: 0, errors: 0 };
// Ticket API removed; validation for ticket port deprecated.
// const validation = validateEnvironment();
console.log(
  `🔧 Configuration loaded (${validation.warnings} warnings, ${validation.errors} errors)`
);

export { CONFIG };
